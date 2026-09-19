"""The session store: persistent vs recent, names, backup history, history, hotkeys, updates."""
import json
import os
import tomllib
import unittest
from datetime import datetime
from pathlib import Path

from helpers import SmTestCase, client


class Names(SmTestCase):
    def test_new_session_is_persistent_and_named(self):
        self.assertIsNone(self.write(self.session("Work Setup")))
        self.assertTrue((self.persistent / "work-setup.toml").exists())

    def test_names_unique_ignoring_case_and_format(self):
        self.write(self.session("Work Setup"))
        self.assertIn("already exists", self.write(self.session("work SETUP")))

    def test_edit_keeps_file_and_header_comments(self):
        (self.persistent / "hand.toml").write_text('# my header\n# keep\n\nname = "Hand"\n\n[[window]]\ncmd = "x"\n')
        self.assertIsNone(self.write(self.session("Hand Edited", "firefox"), stem="hand"))
        text = (self.persistent / "hand.toml").read_text()
        self.assertIn("# my header", text)
        self.assertEqual(tomllib.loads(text)["name"], "Hand Edited")

    def test_blank_fields_from_the_form_are_dropped(self):
        self.write({"name": "B", "window": [{"cmd": "ghostty", "cwd": "", "class": "", "timeout": None}]})
        w = tomllib.loads((self.persistent / "b.toml").read_text())["window"][0]
        self.assertNotIn("cwd", w)
        self.assertNotIn("timeout", w)

    def test_write_survives_a_stow_symlink(self):
        real = self.box.tmp / "real.toml"
        real.write_text('name = "Old"\n[[window]]\ncmd = "x"\n')
        (self.persistent / "x.toml").symlink_to(real)
        self.write(self.session("Renamed", "firefox"), stem="x")
        self.assertTrue((self.persistent / "x.toml").is_symlink())
        self.assertEqual(tomllib.loads(real.read_text())["name"], "Renamed")


class RecentToPersistent(SmTestCase):
    def recent_file(self, stem="before-x", name="Before X"):
        (self.recent / f"{stem}.toml").write_text(
            f'# Saved by hypr-sm\nname = "{name}"\nauto = "before"\nview = {{ primary = 1 }}\n\n'
            '# org.telegram.desktop: secret chat title\n[[window]]\nmonitor = "primary"\ncmd = "ghostty"\nworkspace = 2\n')

    def test_persist_moves_file_and_drops_comments_and_marker(self):
        self.recent_file()
        self.assertIsNone(self.run_cmd(self.sm.cmd_persist, stem="before-x", name="Promoted"))
        self.assertFalse((self.recent / "before-x.toml").exists())
        text = (self.persistent / "promoted.toml").read_text()
        self.assertNotIn("secret", text)
        self.assertNotIn("auto", text)
        self.assertEqual(tomllib.loads(text)["window"][0]["workspace"], 2)

    def test_persist_carries_open_state_to_the_new_name(self):
        self.recent_file()
        self.box.clients = [client("0xa", "ghostty")]
        self.sm.save_state({"before-x": {"name": "x", "windows": ["0xa"]}})
        self.run_cmd(self.sm.cmd_persist, stem="before-x", name="Promoted")
        self.assertIn("promoted", self.sm.load_state())

    def test_persist_refuses_taken_name_and_already_persistent(self):
        self.write(self.session("Taken"))
        self.recent_file()
        self.assertIn("already exists", self.run_cmd(self.sm.cmd_persist, stem="before-x", name="TAKEN"))
        self.assertIn("already persistent", self.run_cmd(self.sm.cmd_persist, stem="taken", name="Z"))

    def test_recent_sessions_cannot_be_edited_or_renamed(self):
        self.recent_file()
        self.assertIn("persistent", self.write(self.session("Whatever"), stem="before-x"))
        self.assertIn("recent", self.run_cmd(self.sm.cmd_rename, stem="before-x", name="Nope"))

    def test_rename_only_touches_the_name_line(self):
        (self.persistent / "hand.toml").write_text('# my header\n\nname = "Hand"\n\n[[window]]\ncmd = "ghostty"\n')
        self.run_cmd(self.sm.cmd_rename, stem="hand", name="Hand Renamed")
        text = (self.persistent / "hand.toml").read_text()
        self.assertIn("# my header", text)
        self.assertIn('name = "Hand Renamed"', text)
        self.assertIn('cmd = "ghostty"', text)

    def test_rename_to_taken_name_refused_but_own_name_allowed(self):
        self.write(self.session("A"))
        self.write(self.session("B"))
        self.assertIn("already exists", self.run_cmd(self.sm.cmd_rename, stem="b", name="a"))
        self.assertIsNone(self.run_cmd(self.sm.cmd_rename, stem="b", name="B"))

    def test_duplicate_leaves_original_and_never_inherits_a_hotkey(self):
        self.write(self.session("Base", hotkey="SUPER ALT 5"))
        self.assertIsNone(self.run_cmd(self.sm.cmd_duplicate, stem="base", name="Base copy"))
        self.assertIn("hotkey", (self.persistent / "base.toml").read_text())
        self.assertNotIn("hotkey", (self.persistent / "base-copy.toml").read_text())


class ListAndKinds(SmTestCase):
    def test_persistent_first_by_name_then_recent_with_kinds(self):
        self.write(self.session("Zeta"))
        self.write(self.session("alpha"))
        for stem, body in (("autosave", 'name = "Last"\nauto = "autosave"\n'),
                           ("previous-session", 'name = "Prev"\n'),
                           ("before-a", 'name = "Before A"\nauto = "before"\n')):
            (self.recent / f"{stem}.toml").write_text(body + '[[window]]\ncmd = "x"\n')
        out = self.json_of(self.sm.cmd_list)["sessions"]
        self.assertEqual([(s["name"], s["persistent"]) for s in out[:2]], [("alpha", True), ("Zeta", True)])
        self.assertEqual({s["stem"]: s["kind"] for s in out[2:]},
                         {"autosave": "autosave", "previous-session": "previous", "before-a": "before"})

    def test_broken_file_is_listed_not_fatal(self):
        (self.persistent / "bad.toml").write_text("name = = ")
        self.assertEqual(self.json_of(self.sm.cmd_list)["sessions"][0]["kind"], "broken")

    def test_running_and_last_opened_and_hotkey(self):
        self.write(self.session("Two", "ghostty", "ghostty", hotkey="SUPER ALT 2"))
        self.box.clients = [client("0x1", "ghostty")]
        self.sm.touch_usage("two")
        s = self.json_of(self.sm.cmd_list)["sessions"][0]
        self.assertEqual([w["running"] for w in s["windows"]], [True, False])   # each open window claimed once
        self.assertGreater(s["last_opened"], 0)
        self.assertEqual(s["hotkey"], "SUPER ALT 2")

    def test_running_flags_by_class_pattern_and_program_name(self):
        f = self.sm.running_flags
        self.assertEqual(f([{"cmd": "/x/chrome", "class": "^google\\-chrome$"}], [{"class": "google-chrome"}]), [True])
        self.assertEqual(f([{"cmd": "firefox"}], [{"class": "firefox"}]), [True])
        self.assertEqual(f([{"cmd": "firefox"}], [{"class": "kitty"}]), [False])


class Delete(SmTestCase):
    def test_delete_any_kind_by_name_or_id(self):
        self.write(self.session("Gone"))
        (self.recent / "autosave.toml").write_text('name = "Last"\n[[window]]\ncmd = "x"\n')
        self.assertIsNone(self.run_cmd(self.sm.cmd_delete, name="gone"))
        self.assertIsNone(self.run_cmd(self.sm.cmd_delete, name="autosave"))
        self.assertIn("no session", self.run_cmd(self.sm.cmd_delete, name="nope"))

    def test_ambiguous_name_refused(self):
        self.write(self.session("Same"))
        (self.recent / "other.toml").write_text('name = "Same"\n[[window]]\ncmd = "x"\n')
        self.assertIn("ambiguous", self.run_cmd(self.sm.cmd_delete, name="Same"))


class Backup(SmTestCase):
    def setUp(self):
        super().setUp()
        self.need_git()

    def log(self):
        return self.sm._git("log", "--pretty=%s").stdout.split("\n")[:-1]

    def test_every_change_is_a_commit(self):
        self.write(self.session("Keep"))
        self.write(self.session("Keep", "foot"), stem="keep")
        self.run_cmd(self.sm.cmd_rename, stem="keep", name="Kept")
        self.assertEqual(self.log(), ["rename to Kept", "edit Keep", "create Keep"])

    def test_deleted_session_is_restorable_with_latest_content(self):
        self.write(self.session("Keep"))
        self.write(self.session("Keep", "one", "two"), stem="keep")
        self.run_cmd(self.sm.cmd_delete, name="Keep")
        gone = self.sm.deleted_sessions()
        self.assertEqual([d["name"] for d in gone], ["Keep"])
        self.assertIsNone(self.run_cmd(self.sm.cmd_untrash, stem=gone[0]["id"]))
        self.assertEqual(len(tomllib.loads((self.persistent / "keep.toml").read_text())["window"]), 2)
        self.assertEqual(self.sm.deleted_sessions(), [])   # restored: no longer listed

    def test_restore_when_name_was_reused_renames_and_overwrites_nothing(self):
        self.write(self.session("Keep"))
        self.run_cmd(self.sm.cmd_delete, name="Keep")
        self.write(self.session("Keep", "other"))
        self.run_cmd(self.sm.cmd_untrash, stem=self.sm.deleted_sessions()[0]["id"])
        names = sorted(self.sm.file_name(f) for f, pers in self.sm.all_files() if pers)
        self.assertEqual(names, ["Keep", "Keep (restored)"])

    def test_unknown_id_refused(self):
        self.write(self.session("A"))
        self.assertIn("no deleted session", self.run_cmd(self.sm.cmd_untrash, stem="nope"))

    def test_backup_can_be_switched_off(self):
        (self.box.tmp / "config.toml").write_text("[backup]\nenabled = false\n")
        self.write(self.session("Quiet"))
        self.assertFalse((self.persistent / ".git").exists())


class Settings(SmTestCase):
    def cfg(self, text):
        (self.box.tmp / "config.toml").write_text(text)
        return self.sm.settings()

    def test_defaults_overrides_and_bad_input(self):
        self.assertEqual(self.sm.settings()["autosave"]["every"], 300)
        c = self.cfg('[autosave]\nevery = 60\nbogus = 1\n[login_prompt]\nmax_windows = "many"\n[nope]\nx = 1\n')
        self.assertEqual(c["autosave"]["every"], 60)
        self.assertEqual(c["login_prompt"]["max_windows"], 3)   # wrong type ignored
        self.assertNotIn("nope", c)
        self.assertEqual(self.cfg("this is [ not toml")["autosave"]["every"], 300)


class AutosaveHistory(SmTestCase):
    def autosave(self, *cmds):
        body = 'name = "Last session (autosaved)"\nauto = "autosave"\n' + "".join(
            f'\n[[window]]\nmonitor = "primary"\ncmd = "{c}"\n' for c in cmds)
        (self.recent / "autosave.toml").write_text(body)

    def test_history_copy_skipped_when_unchanged_and_pruned_to_keep(self):
        (self.box.tmp / "config.toml").write_text("[autosave]\nhistory_keep = 2\n")
        t = lambda h, m: datetime(2026, 9, 19, h, m)
        self.autosave("a", "b")
        self.assertIsNotNone(self.sm.write_history(t(10, 0)))
        self.assertIsNone(self.sm.write_history(t(10, 30)))   # identical
        self.autosave("a", "c")
        self.sm.write_history(t(11, 0))
        self.autosave("x")
        self.sm.write_history(t(11, 30))
        names = sorted(p.name for p in (self.recent / "history").glob("*.toml"))
        self.assertEqual(names, ["autosave-20260919-1100.toml", "autosave-20260919-1130.toml"])
        kinds = {f.stem: self.sm.session_kind(f, p, {}) for f, p in self.sm.all_files()}
        self.assertEqual(kinds["autosave-20260919-1130"], "history")

    def test_rotate_previous_at_login(self):
        self.assertFalse(self.sm.rotate_previous())
        self.autosave("a")
        self.assertTrue(self.sm.rotate_previous())
        self.assertIn("Previous session", (self.recent / "previous-session.toml").read_text())
        self.assertFalse((self.recent / "autosave.toml").exists())
        self.assertFalse(self.sm.rotate_previous())   # nothing to rotate: previous is not clobbered
        self.assertTrue((self.recent / "previous-session.toml").exists())

    def test_prune_before_keeps_newest_and_leaves_manual_sessions(self):
        for i in range(7):
            f = self.recent / f"b{i}.toml"
            f.write_text(f'name = "Before X {i}"\n{"auto = " + chr(34) + "before" + chr(34) if i % 2 == 0 else ""}\n[[window]]\ncmd = "x"\n')
            os.utime(f, (1000 + i, 1000 + i))
        (self.recent / "manual.toml").write_text('name = "Mine"\n[[window]]\ncmd = "x"\n')
        self.sm.prune_before(5)
        left = sorted(p.stem for p in self.recent.glob("*.toml"))
        self.assertEqual(left, ["b2", "b3", "b4", "b5", "b6", "manual"])


class Hotkeys(SmTestCase):
    def test_binds_file_uses_switch_mode_never_replace(self):
        self.write(self.session("One", hotkey="SUPER ALT 7"))
        self.write(self.session("Two", hotkey="SUPER SHIFT F5"))
        binds = (self.box.tmp / "binds.lua").read_text()
        self.assertIn('hl.bind("SUPER + ALT + 7"', binds)
        self.assertIn('hl.bind("SUPER + SHIFT + F5"', binds)
        self.assertIn("--mode switch", binds)
        self.assertNotIn("replace", binds)

    def test_duplicate_hotkey_refused_in_any_spelling(self):
        self.write(self.session("One", hotkey="SUPER ALT 7"))
        self.assertIn("already used", self.write(self.session("Two", hotkey="super+alt+7")))

    def test_launcher_entries_follow_the_sessions_and_spare_foreign_files(self):
        apps = self.box.tmp / "apps"
        (apps / "other.desktop").write_text("[Desktop Entry]\nName=Mine\n")
        self.write(self.session("Good"))
        self.write(self.session("Gone"))
        self.run_cmd(self.sm.cmd_delete, name="Gone")
        self.assertEqual(sorted(p.name for p in apps.iterdir()), ["hypr-sm-session-good.desktop", "other.desktop"])
        self.assertIn("Name=Session: Good", (apps / "hypr-sm-session-good.desktop").read_text())

    def test_launcher_entries_can_be_switched_off(self):
        (self.box.tmp / "config.toml").write_text("[launcher]\nentries = false\n")
        self.write(self.session("Quiet"))
        self.assertEqual(list((self.box.tmp / "apps").iterdir()), [])


class Update(SmTestCase):
    def test_merge_keeps_hand_tuned_keys_and_reports_the_diff(self):
        old = [{"cmd": "ghostty", "monitor": "primary", "workspace": 1, "class": "^ghost.*", "timeout": 30, "run": "npm dev",
                "floating": True, "geometry": {"x": 1, "y": 2, "w": 300, "h": 200}, "tabs": ["https://a", "https://b"]},
               {"cmd": "gone-app", "monitor": "primary"}]
        new = [{"cmd": "ghostty", "monitor": "secondary", "workspace": 6, "class": "^ghostty$",
                "geometry": {"x": 9, "y": 9, "w": 400, "h": 300}, "tabs": ["https://a"]},
               {"cmd": "brand-new", "monitor": "primary"}]
        merged, diff = self.sm.merge_windows(old, new)
        g = merged[0]
        self.assertEqual((g["timeout"], g["run"], g["class"]), (30, "npm dev", "^ghost.*"))
        self.assertNotIn("floating", g)   # captured keys come from the new capture
        self.assertEqual((diff["added"], diff["removed"]), (["brand-new"], ["gone-app"]))
        what = diff["changed"][0]["what"]
        self.assertTrue(any("workspace 1 -> 6" in w for w in what) and any("tabs 2 -> 1" in w for w in what))

    def test_identical_is_an_empty_diff(self):
        _, d = self.sm.merge_windows([{"cmd": "x", "monitor": "primary"}], [{"cmd": "x", "monitor": "primary"}])
        self.assertFalse(d["added"] or d["removed"] or d["changed"])

    def test_cmd_update_dry_run_then_real_keeps_name_hotkey_header(self):
        self.write(self.session("Upd", hotkey="SUPER ALT 7"))
        p = self.persistent / "upd.toml"
        p.write_text("# my header\n" + p.read_text())
        self.sm.restorable = lambda clients, mons: ([
            (0, {"address": "a1"}, {"cmd": "ghostty", "monitor": "primary", "workspace": 3}, "n"),
            (1, {"address": "a2"}, {"cmd": "extra", "monitor": "primary"}, "n")], [])
        self.sm.current_view = lambda mons: {"primary": 3}
        dry = self.json_of(self.sm.cmd_update, stem="upd", windows=None, dry_run=True)
        self.assertEqual(dry["added"], ["extra"])
        self.assertEqual(len(tomllib.loads(p.read_text())["window"]), 1)   # dry run wrote nothing
        self.run_cmd(self.sm.cmd_update, stem="upd", windows=None, dry_run=False)
        data = tomllib.loads(p.read_text())
        self.assertEqual((len(data["window"]), data["hotkey"], data["view"]), (2, "SUPER ALT 7", {"primary": 3}))
        self.assertIn("# my header", p.read_text())

    def test_only_persistent_sessions_can_be_updated(self):
        (self.recent / "autosave.toml").write_text('name = "L"\n[[window]]\ncmd = "x"\n')
        self.assertIn("persistent", self.run_cmd(self.sm.cmd_update, stem="autosave", windows=None, dry_run=True))


class LoginPrompt(SmTestCase):
    def setUp(self):
        super().setUp()
        bin_ = self.box.tmp / "bin" / "notify-send"
        bin_.write_text('#!/bin/bash\necho "$@" >> "$FAKE_LOG"\necho "$FAKE_ANSWER"\n')
        bin_.chmod(0o755)
        os.environ["FAKE_LOG"] = str(self.box.tmp / "notify.log")
        self.addCleanup(lambda: [os.environ.pop(k, None) for k in ("FAKE_LOG", "FAKE_ANSWER")])
        self.opened = []
        self.sm.cmd_open = lambda a: self.opened.append((a.session, a.mode))
        self.prev = self.recent / "previous-session.toml"

    def prompt(self, answer, previous_windows=2, cfg="", busy=0):
        self.prev.write_text('name = "P"\n' + '[[window]]\ncmd = "ghostty"\n' * previous_windows)
        (self.box.tmp / "config.toml").write_text(cfg)
        os.environ["FAKE_ANSWER"] = answer
        self.opened.clear()
        self.box.clients = [client(f"0x{i}", "app", pid=i) for i in range(busy)]
        # every fake window counts as saveable (their command lines can't be read in a sandbox)
        self.sm.restorable = lambda clients, mons: ([None] * len(clients), [])
        self.sm.cmd_login_prompt(__import__("argparse").Namespace(now=True))
        log = self.box.tmp / "notify.log"
        return log.read_text() if log.exists() else ""

    def test_restore_click_replace_opens_the_previous_session(self):
        self.assertIn("Restore your previous session?", self.prompt("restore"))
        self.assertEqual(self.opened, [("previous-session", "replace")])

    def test_dismiss_and_ignored_notification_open_nothing(self):
        self.prompt("no")
        self.assertEqual(self.opened, [])
        self.prompt("")
        self.assertEqual(self.opened, [])

    def test_no_prompt_for_a_trivial_previous_session_when_disabled_or_already_busy(self):
        for kw in ({"previous_windows": 1}, {"cfg": "[login_prompt]\nenabled = false\n"}, {"busy": 5}):
            self.assertNotIn("Restore your previous session?", self.prompt("restore", **kw), kw)
            self.assertEqual(self.opened, [], kw)


if __name__ == "__main__":
    unittest.main()
