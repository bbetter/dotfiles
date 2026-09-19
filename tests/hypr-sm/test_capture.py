"""Reading state from running apps: terminal cwd, Chrome/Firefox tabs, IDE projects, saveability."""
import json
import os
import struct
import unittest
from pathlib import Path

from helpers import FAKE_MONITORS, SmTestCase, client


# ----------------------------- synthetic Chromium session file (SNSS v3) ----------------------------
def cmd(cid, payload):
    return struct.pack("<H", len(payload) + 1) + bytes([cid]) + payload


def pstr(s):
    b = s.encode()
    return struct.pack("<i", len(b)) + b + b"\0" * ((4 - len(b) % 4) % 4)


def pstr16(s):
    b = s.encode("utf-16-le")
    return struct.pack("<i", len(s)) + b + b"\0" * ((4 - len(b) % 4) % 4)


def nav(tab, index, url, title):
    body = struct.pack("<ii", tab, index) + pstr(url) + pstr16(title)
    return cmd(6, struct.pack("<I", len(body)) + body)


def snss(*cmds, version=3):
    return b"SNSS" + struct.pack("<i", version) + b"".join(cmds)


tab_window = lambda w, t: cmd(0, struct.pack("<ii", w, t))
tab_index = lambda t, i: cmd(2, struct.pack("<ii", t, i))
sel_nav = lambda t, i: cmd(7, struct.pack("<ii", t, i))
sel_tab = lambda w, i: cmd(8, struct.pack("<ii", w, i))
win_type = lambda w, ty: cmd(9, struct.pack("<ii", w, ty))
tab_closed = lambda t: cmd(16, struct.pack("<iq", t, 0))
win_closed = lambda w: cmd(17, struct.pack("<iq", w, 0))
prune_back = lambda t, keep: cmd(5, struct.pack("<ii", t, keep))
prune_front = lambda t, n: cmd(25, struct.pack("<ii", t, n))


class ChromiumSession(SmTestCase):
    def read(self, data):
        f = self.box.tmp / "Session_1"
        f.write_bytes(data)
        return self.sm.read_chromium_session(f)

    def test_windows_tabs_selection_and_order(self):
        s = self.read(snss(
            tab_window(1, 10), tab_index(10, 1), nav(10, 0, "https://b", "Second tab"),
            tab_window(1, 11), tab_index(11, 0), nav(11, 0, "https://a", "First tab"), sel_tab(1, 1),
            tab_window(2, 20), tab_index(20, 0), nav(20, 0, "https://c", "Other window")))
        self.assertEqual(len(s), 2)
        w1 = next(w for w in s if len(w["tabs"]) == 2)
        self.assertEqual([u for u, _ in w1["tabs"]], ["https://a", "https://b"])   # ordered by tab index
        self.assertEqual(w1["selected"], 1)

    def test_tab_shows_its_current_history_entry(self):
        s = self.read(snss(tab_window(1, 10), tab_index(10, 0), nav(10, 0, "https://old", "Old"),
                           nav(10, 1, "https://new", "New"), sel_nav(10, 1)))
        self.assertEqual(s[0]["tabs"][0], ("https://new", "New"))

    def test_closed_tabs_windows_and_popups_are_excluded(self):
        s = self.read(snss(
            tab_window(1, 10), tab_index(10, 0), nav(10, 0, "https://keep", "K"),
            tab_window(1, 11), tab_index(11, 1), nav(11, 0, "https://closed", "C"), tab_closed(11),
            tab_window(2, 20), tab_index(20, 0), nav(20, 0, "https://popup", "P"), win_type(2, 1),
            tab_window(3, 30), tab_index(30, 0), nav(30, 0, "https://gone", "G"), win_closed(3)))
        self.assertEqual([[u for u, _ in w["tabs"]] for w in s], [["https://keep"]])

    def test_pruned_history(self):
        s = self.read(snss(tab_window(1, 10), tab_index(10, 0), nav(10, 0, "https://a", "A"), nav(10, 1, "https://b", "B"),
                           nav(10, 2, "https://c", "C"), prune_back(10, 2), sel_nav(10, 1)))
        self.assertEqual(s[0]["tabs"][0][0], "https://b")
        s = self.read(snss(tab_window(1, 10), tab_index(10, 0), nav(10, 0, "https://a", "A"), nav(10, 1, "https://b", "B"),
                           prune_front(10, 1), sel_nav(10, 1)))
        self.assertEqual(s[0]["tabs"][0][0], "https://b")   # indices shift down; selection follows

    def test_torn_tail_and_unknown_command_are_tolerated(self):
        good = snss(tab_window(1, 10), tab_index(10, 0), nav(10, 0, "https://a", "A"), cmd(99, b"???"))
        s = self.read(good + b"\x40\x00\x06abc")   # Chrome was mid-write
        self.assertEqual(s[0]["tabs"][0][0], "https://a")

    def test_unsupported_versions_and_garbage_raise(self):
        with self.assertRaises(ValueError):
            self.read(snss(version=2))
        with self.assertRaises(ValueError):
            self.read(b"not a session file")


class ChromiumTabs(SmTestCase):
    def tabs(self, wins, sess):
        d = self.box.tmp / "chrome" / "Default" / "Sessions"
        d.mkdir(parents=True, exist_ok=True)
        (d / "Session_1").write_bytes(b"x")
        cmdline = lambda pid: [f"--user-data-dir={self.box.tmp / 'chrome'}"]
        return self.sm.browser_tabs(wins, cmdline, lambda path: sess)

    C = staticmethod(lambda a, t: client(a, "google-chrome", t, pid=5))

    def test_matches_windows_by_selected_tab_title(self):
        sess = [{"tabs": [("https://a/1", "Alpha"), ("https://a/2", "x")], "selected": 0}, {"tabs": [("https://b/1", "Beta")], "selected": 0}]
        r = self.tabs([self.C("a", "Alpha - Google Chrome"), self.C("b", "Beta - Google Chrome")], sess)
        self.assertEqual(r, {"a": ["https://a/1", "https://a/2"], "b": ["https://b/1"]})

    def test_identical_titles_are_declined_not_guessed(self):
        sess = [{"tabs": [("https://a", "New Tab")], "selected": 0}, {"tabs": [("https://b", "New Tab")], "selected": 0}]
        self.assertEqual(self.tabs([self.C("a", "New Tab - Google Chrome"), self.C("b", "New Tab - Google Chrome")], sess), {})

    def test_incognito_window_absent_from_session_gets_nothing(self):
        sess = [{"tabs": [("https://a/1", "Alpha")], "selected": 0}]
        r = self.tabs([self.C("a", "Alpha - Google Chrome"), self.C("inc", "Secret - Google Chrome (Incognito)")], sess)
        self.assertEqual(r, {"a": ["https://a/1"]})

    def test_empty_session_title_pairs_the_leftover_by_elimination(self):
        sess = [{"tabs": [("https://a", "Alpha")], "selected": 0}, {"tabs": [("https://b", "")], "selected": 0}]
        r = self.tabs([self.C("a", "Alpha - Google Chrome"), self.C("b", "Loading...")], sess)
        self.assertEqual(r, {"a": ["https://a"], "b": ["https://b"]})   # "" must not match everything

    def test_unread_count_prefix_and_new_tab_pages(self):
        r = self.tabs([self.C("a", "(6) Alpha - Google Chrome")], [{"tabs": [("https://a", "Alpha")], "selected": 0}])
        self.assertEqual(r, {"a": ["https://a"]})
        r = self.tabs([self.C("a", "New Tab - Google Chrome")], [{"tabs": [("chrome://newtab/", "New Tab")], "selected": 0}])
        self.assertEqual(r, {})

    def test_unreadable_session_and_other_browsers_ignored(self):
        def boom(path):
            raise ValueError("encrypted")
        d = self.box.tmp / "chrome" / "Default" / "Sessions"
        d.mkdir(parents=True, exist_ok=True)
        (d / "Session_1").write_bytes(b"x")
        cmdline = lambda pid: [f"--user-data-dir={self.box.tmp / 'chrome'}"]
        self.assertEqual(self.sm.browser_tabs([self.C("a", "t")], cmdline, boom), {})
        self.assertEqual(self.tabs([client("z", "kitty", "t")], [{"tabs": [("https://a", "t")], "selected": 0}]), {})


# ------------------------------------------------ Firefox ------------------------------------------
def mozlz4(doc):
    """A valid mozlz4 file. LZ4 allows a block of literals only, so no compressor is needed."""
    raw = json.dumps(doc).encode()
    n = len(raw)
    head = bytearray()
    if n < 15:
        head.append(n << 4)
    else:
        head.append(0xF0)
        rest = n - 15
        while rest >= 255:
            head.append(255)
            rest -= 255
        head.append(rest)
    return b"mozLz40\0" + struct.pack("<I", n) + bytes(head) + raw


class Lz4(SmTestCase):
    def test_literals_matches_and_overlapping_copies(self):
        d = self.sm.lz4_block_decompress
        self.assertEqual(d(bytes([0x35]) + b"abc" + bytes([3, 0]) + bytes([0x30]) + b"xyz"), b"abcabcabcabcxyz")
        self.assertEqual(d(bytes([0xF0, 5]) + b"a" * 20), b"a" * 20)                       # long literal run
        self.assertEqual(d(bytes([0x1F]) + b"a" + bytes([1, 0, 255, 3]) + bytes([0x10]) + b"z"), b"a" * 278 + b"z")

    def test_corrupt_data_rejected(self):
        with self.assertRaises((ValueError, IndexError)):
            self.sm.lz4_block_decompress(bytes([0x11]) + b"a" + bytes([9, 0]))


class Firefox(SmTestCase):
    def session_file(self, doc):
        d = self.box.tmp / "ff" / "x" / "sessionstore-backups"
        d.mkdir(parents=True, exist_ok=True)
        (d / "recovery.jsonlz4").write_bytes(mozlz4(doc) if doc is not None else b"garbage")
        return self.box.tmp / "ff"

    DOC = {"windows": [
        {"tabs": [{"entries": [{"url": "https://a/1", "title": "Alpha page"}], "index": 1},
                  {"entries": [{"url": "https://a/2", "title": "second"}], "index": 1},
                  {"entries": [{"url": "about:newtab", "title": "New Tab"}], "index": 1}], "selected": 1},
        {"tabs": [{"entries": [{"url": "https://b/1", "title": "Beta page"}, {"url": "https://b/1b", "title": "Beta moved"}], "index": 2}], "selected": 1}]}
    F = staticmethod(lambda a, t: client(a, "firefox", t))

    def test_reads_windows_and_the_current_entry_of_each_tab(self):
        s = self.sm.read_firefox_session(self.session_file(self.DOC) / "x" / "sessionstore-backups" / "recovery.jsonlz4")
        self.assertEqual((len(s), len(s[0]["tabs"])), (2, 3))
        self.assertEqual(s[1]["tabs"][0], ("https://b/1b", "Beta moved"))

    def test_two_windows_matched_new_tab_dropped_private_ignored(self):
        root = self.session_file(self.DOC)
        r = self.sm.firefox_tabs([self.F("a", "Alpha page \u2014 Mozilla Firefox"), self.F("b", "Beta moved \u2014 Mozilla Firefox"),
                                  self.F("p", "Secret \u2014 Mozilla Firefox (Private Browsing)")], root=root)
        self.assertEqual(r, {"a": ["https://a/1", "https://a/2"], "b": ["https://b/1b"]})

    def test_identical_titles_missing_or_corrupt_file_and_other_apps(self):
        root = self.session_file(self.DOC)
        self.assertEqual(self.sm.firefox_tabs([self.F("a", "same"), self.F("b", "same")], root=root), {})
        self.assertEqual(self.sm.firefox_tabs([self.F("a", "t")], root=self.box.tmp / "nothing"), {})
        self.assertEqual(self.sm.firefox_tabs([self.F("a", "t")], root=self.session_file(None)), {})
        self.assertEqual(self.sm.firefox_tabs([client("k", "kitty", "t")], root=root), {})


# ------------------------------------------------ terminals ----------------------------------------
class TerminalCwd(SmTestCase):
    def cwds(self, wins, tree, dirs):
        return self.sm.terminal_cwds(wins, kids=lambda pid: tree.get(pid, []), cwd_of=lambda p: dirs.get(p))

    T = staticmethod(lambda a, pid, title, cls="com.mitchellh.ghostty": client(a, cls, title, pid=pid))

    def test_one_window_one_shell(self):
        self.assertEqual(self.cwds([self.T("a", 1, "x")], {1: [10]}, {10: "/usr"}), {"a": "/usr"})

    def test_tabs_or_splits_take_the_oldest_shell(self):
        self.assertEqual(self.cwds([self.T("a", 1, "x")], {1: [10, 11]}, {10: "/usr", 11: "/etc"}), {"a": "/usr"})

    def test_shared_process_told_apart_by_prompt_title(self):
        r = self.cwds([self.T("a", 1, "me@h:/usr"), self.T("b", 1, "me@h:/etc")], {1: [10, 11]}, {10: "/usr", 11: "/etc"})
        self.assertEqual(r, {"a": "/usr", "b": "/etc"})

    def test_shared_process_without_titles_is_declined_not_guessed(self):
        self.assertEqual(self.cwds([self.T("a", 1, "claude"), self.T("b", 1, "vim")], {1: [10, 11]}, {10: "/usr", 11: "/etc"}), {})

    def test_one_title_match_plus_one_left_over_pairs_by_elimination(self):
        r = self.cwds([self.T("a", 1, "me@h:/usr"), self.T("b", 1, "claude")], {1: [10, 11]}, {10: "/usr", 11: "/etc"})
        self.assertEqual(r, {"a": "/usr", "b": "/etc"})

    def test_separate_processes_exact_gone_dirs_and_non_terminals_skipped(self):
        self.assertEqual(self.cwds([self.T("a", 1, "x"), self.T("b", 2, "y")], {1: [10], 2: [20]}, {10: "/usr", 20: "/etc"}),
                         {"a": "/usr", "b": "/etc"})
        self.assertEqual(self.cwds([self.T("a", 1, "x")], {1: [10]}, {10: "/nonexistent-dir-xyz"}), {})
        self.assertEqual(self.cwds([self.T("a", 1, "x", cls="firefox")], {1: [10]}, {10: "/usr"}), {})

    def test_home_is_not_recorded(self):
        self.assertIsNone(self.sm.abbreviate_home(self.sm.HOME))
        self.assertEqual(self.sm.abbreviate_home(self.sm.HOME + "/p"), "~/p")
        self.assertEqual(self.sm.abbreviate_home("/usr"), "/usr")


# ------------------------------------------------ IDE projects -------------------------------------
class IdeProjects(SmTestCase):
    def setUp(self):
        super().setUp()
        t = self.box.tmp
        for d in ("a/proj", "b/proj", "only/solo", "install/jbr/bin", "install/bin"):
            (t / d).mkdir(parents=True)
        (t / "install/jbr/bin/java").write_text("")
        (t / "install/bin/studio.sh").write_text("")
        self.recent = lambda cls: [(str(t / "a/proj"), 100), (str(t / "b/proj"), 900), (str(t / "only/solo"), 5), (str(t / "gone/ghost"), 1)]
        self.W = lambda a, cls, title: client(a, cls, title)

    def test_jetbrains_project_from_title_and_recent_list(self):
        r = self.sm.ide_projects([self.W("w", "jetbrains-studio", "solo \u2013 MainActivity.kt")], recent=self.recent)
        self.assertEqual(r, {"w": str(self.box.tmp / "only/solo")})

    def test_most_recent_wins_ambiguous_open_windows_declined_stale_dirs_ignored(self):
        one = self.sm.ide_projects([self.W("w", "jetbrains-studio", "proj \u2013 x.kt")], recent=self.recent)
        self.assertEqual(one, {"w": str(self.box.tmp / "b/proj")})
        two = self.sm.ide_projects([self.W("w1", "jetbrains-studio", "proj \u2013 a"), self.W("w2", "jetbrains-studio", "proj \u2013 b")], recent=self.recent)
        self.assertEqual(two, {})
        self.assertEqual(self.sm.ide_projects([self.W("w", "jetbrains-studio", "ghost \u2013 x")], recent=self.recent), {})
        self.assertEqual(self.sm.ide_projects([self.W("w", "jetbrains-studio", "unknown")], recent=self.recent), {})

    def test_unreadable_project_list_is_no_project_not_a_crash(self):
        def boom(cls):
            raise OSError("x")
        self.assertEqual(self.sm.ide_projects([self.W("w", "jetbrains-studio", "solo")], recent=boom), {})

    def test_vscode_title_forms(self):
        folders = lambda: [str(self.box.tmp / "only/solo")]
        want = {"v": str(self.box.tmp / "only/solo")}
        for title in ("main.py - solo - Visual Studio Code", "solo - Visual Studio Code"):
            self.assertEqual(self.sm.ide_projects([self.W("v", "Code", title)], folders=folders), want, title)
        self.assertEqual(self.sm.ide_projects([self.W("v", "Code", "Welcome - Visual Studio Code")], folders=folders), {})
        self.assertEqual(self.sm.ide_projects([self.W("v", "kitty", "solo")], recent=self.recent, folders=folders), {})

    def test_a_running_ides_java_command_maps_back_to_its_launcher(self):
        java = str(self.box.tmp / "install/jbr/bin/java")
        self.assertEqual(self.sm.jetbrains_launcher([java, "-classpath", "x"], "jetbrains-studio"), str(self.box.tmp / "install/bin/studio.sh"))
        self.assertIsNone(self.sm.jetbrains_launcher([java], "jetbrains-idea"))         # no idea.sh there
        self.assertIsNone(self.sm.jetbrains_launcher(["/usr/bin/java"], "jetbrains-studio"))
        self.assertIsNone(self.sm.jetbrains_launcher([java], "firefox"))

    def test_saved_ide_window_uses_the_launcher_script(self):
        java = str(self.box.tmp / "install/jbr/bin/java")
        items, _ = self.sm.restorable([client("s", "jetbrains-studio", "zzz-none", pid=7)], FAKE_MONITORS,
                                      cmdline=lambda pid: [java, "-classpath", "a:b"])
        self.assertEqual(items[0][2]["cmd"], str(self.box.tmp / "install/bin/studio.sh"))


# ------------------------------------------------ what can be saved -------------------------------
class Saveability(SmTestCase):
    def test_skipped_windows_carry_reason_and_address(self):
        clients = [client("g", "steam_app_123"), client("s", "kitty", ws=-99, workspace={"id": -99, "name": "special:magic"}),
                   client("u", "weird", pid=2), client("ok", "foot", pid=3)]
        items, skipped = self.sm.restorable(clients, FAKE_MONITORS, cmdline=lambda pid: None if pid == 2 else ["prog"])
        self.assertEqual([c["address"] for _, c, _, _ in items], ["ok"])
        self.assertEqual(sorted((r, a) for _, r, a in skipped), [("command unreadable", "u"), ("game", "g"), ("scratchpad", "s")])
        self.assertTrue(all(r in self.sm.SKIP_REASONS for _, r, _ in skipped))

    def test_the_session_window_itself_is_never_saved(self):
        items, skipped = self.sm.restorable([client("me", "io.Astal.ags", self.sm.GUI_TITLE)], FAKE_MONITORS, cmdline=lambda p: ["x"])
        self.assertEqual((items, skipped), ([], []))

    def test_geometry_floating_pinned_fullscreen_and_workspace_are_captured(self):
        c = client("f", "foot", ws=3, floating=True, pinned=True, fullscreen=2, at=[1927, 100], size=[500, 300], monitor=1)
        items, _ = self.sm.restorable([c], FAKE_MONITORS, cmdline=lambda p: ["foot"])
        w = items[0][2]
        self.assertEqual((w["workspace"], w["floating"], w["pinned"], w["fullscreen"], w["monitor"]), (3, True, True, 2, "secondary"))
        self.assertEqual(w["geometry"], {"x": 7, "y": 100, "w": 500, "h": 300, "sw": 1920, "sh": 1080})   # relative to its monitor

    def test_browser_launch_link_is_not_saved(self):
        items, _ = self.sm.restorable([client("b", "firefox", "t")], FAKE_MONITORS,
                                      cmdline=lambda p: ["/usr/lib/firefox/firefox", "https://stale.example/"])
        self.assertEqual(items[0][2]["cmd"], "/usr/lib/firefox/firefox")


if __name__ == "__main__":
    unittest.main()
