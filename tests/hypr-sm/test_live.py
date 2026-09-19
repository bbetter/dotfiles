"""OPT-IN live tests against a real Hyprland. They open and close throwaway ghostty windows
(class com.hyprsmtest.*) and never touch your own: hypr-sm is fenced with HYPR_SM_ONLY_CLASS.

    HYPR_SM_LIVE=1 python3 -m unittest discover -s tests/hypr-sm -p "test_live.py" -v
"""
import contextlib
import io
import json
import os
import subprocess
import time
import unittest
from argparse import Namespace

from helpers import SmTestCase

LIVE = os.environ.get("HYPR_SM_LIVE") == "1" and os.environ.get("HYPRLAND_INSTANCE_SIGNATURE")


@unittest.skipUnless(LIVE, "set HYPR_SM_LIVE=1 inside a Hyprland session to run")
class Live(SmTestCase):
    def setUp(self):
        super().setUp()
        os.environ["HYPR_SM_ONLY_CLASS"] = r"^com\.hyprsmtest\."
        self.sm.query = self._real_query
        self.addCleanup(self.close_test_windows)
        self.before = {c["address"] for c in self._real_query("clients")}

    def _real_query(self, what):
        r = subprocess.run(["hyprctl", "-j", what], capture_output=True, text=True)
        return json.loads(r.stdout)

    def throwaway_windows(self):
        return [c for c in self._real_query("clients") if c["class"].startswith("com.hyprsmtest.")]

    def close_test_windows(self):
        for c in self.throwaway_windows():
            subprocess.run(["hyprctl", "-q", "dispatch", f'hl.dsp.window.close({{ window = "address:{c["address"]}" }})'])
        time.sleep(1.5)

    def classes(self):
        return sorted(c["class"].split(".")[-1] for c in self.throwaway_windows())

    def make(self, name, *windows):
        self.write({"name": name, "window": [{"monitor": "primary", "workspace": 3, "cmd": f"ghostty --class=com.hyprsmtest.{w}",
                                              "class": f"^com\\.hyprsmtest\\.{w}$", **extra} for w, extra in windows]})

    def open(self, stem, mode, **kw):
        with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()):
            self.sm.cmd_open(Namespace(session=stem, mode=mode, new=False, dry_run=False, yes=True, **kw))
        return out.getvalue()

    def test_replace_progress_and_undo(self):
        self.make("live one", ("one", {}))
        self.make("live two", ("two", {}), ("never", {"cmd": "true", "timeout": 3}))
        self.open("live-one", "alongside")
        self.assertEqual(self.classes(), ["one"])
        out = self.open("live-two", "replace", progress=True)
        self.assertEqual(self.classes(), ["two"])                       # one closed, two opened
        events = [json.loads(l[10:]) for l in out.splitlines() if l.startswith("@progress ")]
        done = events[-1]
        self.assertEqual((done["event"], done["opened"]), ("done", 1))
        self.assertEqual([f["window"] for f in done["failed"]], ["com.hyprsmtest.never"])   # the window that never appeared
        self.assertTrue(self.sm.read_undo())
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.sm.cmd_undo(Namespace(progress=False))
        self.assertEqual(self.classes(), ["one"])                       # undone: the first window is back
        self.assertEqual(self.sm.read_undo()["name"], "undo of live two")   # and the undo can be undone

    def test_pinned_and_fullscreen_are_restored(self):
        self.make("live state", ("pin", {"floating": True, "pinned": True, "geometry": {"x": 100, "y": 100, "w": 500, "h": 300}}),
                  ("full", {"fullscreen": 2}))
        self.open("live-state", "alongside")
        time.sleep(1)
        by = {c["class"].split(".")[-1]: c for c in self.throwaway_windows()}
        self.assertTrue(by["pin"]["pinned"] and by["pin"]["floating"])
        self.assertEqual(by["full"]["fullscreen"], 2)

    def test_tiled_layout_tree_and_sizes_are_rebuilt_on_replace(self):
        # "one big left, two stacked right" on a workspace of the first monitor
        g = lambda x, y, w, h: {"geometry": {"x": x, "y": y, "w": w, "h": h, "sw": 1920, "sh": 1080}}
        self.make("live layout", ("aa", g(7, 57, 1100, 1016)), ("bb", g(1121, 57, 792, 600)), ("cc", g(1121, 671, 792, 402)))
        self.open("live-layout", "replace")
        time.sleep(1)
        got = {c["class"].split(".")[-1]: c["size"] for c in self.throwaway_windows()}
        for k, want in {"aa": (1100, 1016), "bb": (792, 600), "cc": (792, 402)}.items():
            self.assertLessEqual(abs(got[k][0] - want[0]) + abs(got[k][1] - want[1]), 24, f"{k}: {got[k]} vs {want}")


if __name__ == "__main__":
    unittest.main()
