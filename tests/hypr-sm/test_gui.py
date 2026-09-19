"""OPT-IN GUI smoke test: drives the real session window (AGS) inside a fenced test instance.

It copies gui/app-sessions-test.ts (a small driver that finds real widgets and emits their real
signals) into ~/.config/ags for the duration, starts a SEPARATE AGS instance named "hyprsm-test"
(your bar is not restarted), points hypr-sm at throwaway folders, and removes everything after.

    HYPR_SM_LIVE_GUI=1 python3 -m unittest discover -s tests/hypr-sm -p "test_gui.py" -v
"""
import os
import shutil
import signal
import subprocess
import time
import unittest
from pathlib import Path

from helpers import HYPR_SM, SmTestCase

LIVE = os.environ.get("HYPR_SM_LIVE_GUI") == "1" and os.environ.get("HYPRLAND_INSTANCE_SIGNATURE")
AGS_DIR = Path.home() / ".config/ags"
DRIVER = Path(__file__).resolve().parent / "gui" / "app-sessions-test.ts"


@unittest.skipUnless(LIVE, "set HYPR_SM_LIVE_GUI=1 inside a Hyprland session to run")
class GuiSmoke(SmTestCase):
    def setUp(self):
        super().setUp()
        t = self.box.tmp
        self.env = {**os.environ, "HYPR_SM_ONLY_CLASS": r"^com\.hyprsmtest\.", "HYPR_SM_GUI_PREFS": str(t / "gui.json"),
                    "PYTHONDONTWRITEBYTECODE": "1"}
        self.driver = AGS_DIR / "app-sessions-test.ts"
        shutil.copy(DRIVER, self.driver)
        self.addCleanup(lambda: self.driver.unlink(missing_ok=True))
        self.before = {c["address"] for c in self.hypr("clients")}
        self.proc = subprocess.Popen(["ags", "run", str(self.driver)], cwd=AGS_DIR, env=self.env,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        self.addCleanup(self.stop)
        for _ in range(40):
            time.sleep(0.5)
            if "hyprsm-test" in subprocess.run(["ags", "list"], capture_output=True, text=True).stdout:
                break
        else:
            self.fail("the test AGS instance did not start")
        time.sleep(2)

    def stop(self):
        for c in self.hypr("clients"):
            if c["address"] not in self.before and c["class"].startswith("com.hyprsmtest."):
                subprocess.run(["hyprctl", "-q", "dispatch", f'hl.dsp.window.close({{ window = "address:{c["address"]}" }})'])
        try:
            os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)   # the whole group: ags run + its gjs child, never your bar
        except (ProcessLookupError, PermissionError):
            pass
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass

    def hypr(self, what):
        import json
        return json.loads(subprocess.run(["hyprctl", "-j", what], capture_output=True, text=True).stdout)

    def gui(self, *args):
        return subprocess.run(["ags", "request", "-i", "hyprsm-test", *args], capture_output=True, text=True, timeout=20).stdout

    def cli(self, *args, stdin=None):
        return subprocess.run([str(HYPR_SM), *args], input=stdin, capture_output=True, text=True, env=self.env)

    def wait_for(self, text, tries=30):
        for _ in range(tries):
            dump = self.gui("dump")
            if text in dump:
                return dump
            time.sleep(0.5)
        self.fail(f"never saw {text!r} in the window; last dump:\n{self.gui('dump')[:800]}")

    def test_list_search_open_and_delete(self):
        self.env.update(HYPR_SM_PERSISTENT_DIR=str(self.persistent), HYPR_SM_RECENT_DIR=str(self.recent),
                        HYPR_SM_STATE_DIR=str(self.box.tmp / "state"), HYPR_SM_BINDS_FILE=str(self.box.tmp / "binds.lua"),
                        HYPR_SM_LAUNCHER_DIR=str(self.box.tmp / "apps"), HYPR_SM_NO_RELOAD="1")
        # The instance was started before the folders were set: restart it so hypr-sm children inherit them.
        self.stop()
        self.proc = subprocess.Popen(["ags", "run", str(self.driver)], cwd=AGS_DIR, env=self.env,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        time.sleep(9)
        for name, cls in (("GUI Alpha", "alpha"), ("GUI Beta", "beta")):
            self.cli("write", stdin='{"name": "%s", "window": [{"cmd": "ghostty --class=com.hyprsmtest.%s", "class": "^com\\\\.hyprsmtest\\\\.%s$", "monitor": "primary", "workspace": 3}]}' % (name, cls, cls))
        self.gui("sessions", "close")
        time.sleep(0.5)
        self.gui("sessions", "open")
        dump = self.wait_for("GUI Beta")
        self.assertIn("PERSISTENT", dump)
        self.assertLess(dump.index("GUI Alpha"), dump.index("GUI Beta"))          # sorted by name
        self.gui("search", "beta")
        time.sleep(0.8)
        dump = self.gui("dump")
        self.assertIn("GUI Beta", dump)
        self.assertNotIn("GUI Alpha", dump)                                       # the search filtered
        self.gui("search", "")
        time.sleep(0.5)
        self.gui("expand", "GUI Alpha")
        self.gui("cardbtn", "GUI Alpha | Open alongside")
        self.wait_for("Opened GUI Alpha")
        self.assertTrue(any(c["class"] == "com.hyprsmtest.alpha" for c in self.hypr("clients")))
        self.gui("cardbtn", "GUI Alpha | 󰩹")
        self.gui("cardbtn", "GUI Alpha | Delete")
        self.wait_for("Deleted GUI Alpha")
        self.assertFalse((self.persistent / "gui-alpha.toml").exists())


if __name__ == "__main__":
    unittest.main()
