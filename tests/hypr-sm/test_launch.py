"""Launch lines, validation and warnings: what is run when a session window is started."""
import unittest
from helpers import SmTestCase


class ShellLine(SmTestCase):
    def line(self, **w):
        w.setdefault("cmd", "x")
        return self.sm.shell_line(w)

    def test_ghostty_gets_working_directory_flag(self):
        self.assertEqual(self.line(cmd="ghostty", cwd="/usr"), "cd /usr && exec ghostty --working-directory=/usr")

    def test_working_directory_flag_not_duplicated(self):
        line = self.line(cmd="ghostty --working-directory=/etc", cwd="/usr")
        self.assertEqual(line.count("--working-directory"), 1)

    def test_other_terminals_just_cd(self):
        self.assertEqual(self.line(cmd="foot", cwd="/usr"), "cd /usr && exec foot")

    def test_missing_directory_still_opens(self):
        self.assertEqual(self.line(cmd="ghostty", cwd="/nonexistent-dir-xyz"), "exec ghostty")

    def test_chromium_tabs_are_quoted_and_use_new_window(self):
        self.assertEqual(self.line(cmd="/opt/google/chrome/chrome", tabs=["https://a/?x=1&y=2"]),
                         "exec /opt/google/chrome/chrome --new-window 'https://a/?x=1&y=2'")

    def test_firefox_first_tab_new_window_rest_new_tab(self):
        # `--new-window a b` would open TWO windows (verified against a real Firefox)
        self.assertEqual(self.line(cmd="firefox", tabs=["https://a", "https://b", "https://c"]),
                         "exec firefox --new-window https://a --new-tab https://b --new-tab https://c")

    def test_tabs_ignored_for_other_programs(self):
        self.assertEqual(self.line(cmd="ghostty", tabs=["https://a"]), "exec ghostty")

    def test_run_starts_an_interactive_shell_that_stays_open(self):
        import os
        os.environ["SHELL"] = "/usr/bin/zsh"
        self.assertTrue(self.line(cmd="ghostty", run="npm run dev").endswith(
            "-e /usr/bin/zsh -ic 'npm run dev; exec /usr/bin/zsh'"))

    def test_run_ignored_when_command_has_its_own_e_or_is_no_terminal(self):
        self.assertNotIn("-ic", self.line(cmd="ghostty -e adb logcat", run="x"))
        self.assertEqual(self.line(cmd="firefox", run="x"), "exec firefox")

    def test_project_for_jetbrains_and_vscode(self):
        self.assertEqual(self.line(cmd="/opt/x/bin/studio.sh", project="/p"), "exec /opt/x/bin/studio.sh /p")
        self.assertEqual(self.line(cmd="code", project="/p"), "exec code --new-window /p")
        self.assertEqual(self.line(cmd="ghostty", project="/p"), "exec ghostty")


class StripLaunchUrls(SmTestCase):
    def test_link_a_browser_was_started_with_is_dropped(self):
        f = self.sm.strip_launch_urls
        self.assertEqual(f(["/usr/lib/firefox/firefox", "https://x/y"]), ["/usr/lib/firefox/firefox"])
        self.assertEqual(f(["firefox", "--new-window", "https://a", "--new-tab", "https://b", "-P", "work"]),
                         ["firefox", "-P", "work"])
        self.assertEqual(f(["/opt/google/chrome/chrome", "--ozone-platform=wayland", "https://x"]),
                         ["/opt/google/chrome/chrome", "--ozone-platform=wayland"])

    def test_non_browsers_untouched(self):
        argv = ["ghostty", "-e", "https://not-a-browser"]
        self.assertEqual(self.sm.strip_launch_urls(argv), argv)


class Validation(SmTestCase):
    def bad(self, window, **top):
        try:
            self.sm.validate_template({"name": "n", "window": [window], **top}, "t")
            return False
        except self.sm.SmError:
            return True

    def test_required_and_typed_fields(self):
        for w in ({"cmd": ""}, {"cmd": "echo 'oops"}, {"cmd": "c", "workspace": "3"}, {"cmd": "c", "workspace": 0},
                  {"cmd": "c", "monitor": "left"}, {"cmd": "c", "timeout": -1}, {"cmd": "c", "class": "(open"},
                  {"cmd": "c", "floating": "yes"}, {"cmd": "c", "pinned": 1}, {"cmd": "c", "fullscreen": 3},
                  {"cmd": "c", "run": ""}, {"cmd": "c", "project": ""},
                  {"cmd": "c", "geometry": {"x": 1}}, {"cmd": "c", "cwd": 5}):
            self.assertTrue(self.bad(w), w)

    def test_tabs(self):
        for t in ("https://a", ["https://a b"], [""], ["x"] * 501):
            self.assertTrue(self.bad({"cmd": "c", "tabs": t}), t)
        self.assertFalse(self.bad({"cmd": "c", "tabs": ["https://a/1"]}))

    def test_hotkey_needs_modifier_and_key(self):
        for hk in ("just a word", "1", "SUPER"):
            self.assertTrue(self.bad({"cmd": "c"}, hotkey=hk), hk)
        for hk in ("SUPER ALT 1", "super+shift+F5", "CTRL ALT t"):
            self.assertFalse(self.bad({"cmd": "c"}, hotkey=hk), hk)

    def test_needs_a_name_and_a_window(self):
        with self.assertRaises(self.sm.SmError):
            self.sm.validate_template({"name": "  ", "window": [{"cmd": "c"}]}, "t")
        with self.assertRaises(self.sm.SmError):
            self.sm.validate_template({"name": "n", "window": []}, "t")


class Warnings(SmTestCase):
    def warn(self, **w):
        return self.sm.template_warnings({"window": [w]})

    def test_shell_function_is_flagged_real_program_is_not(self):
        self.assertTrue(self.warn(cmd="definitely-not-a-program-xyz"))
        self.assertEqual(self.warn(cmd="/bin/sh"), [])

    def test_misplaced_options_warned(self):
        self.assertTrue(self.warn(cmd="/bin/sh", tabs=["https://a"]))
        self.assertTrue(self.warn(cmd="/bin/sh", run="x"))
        self.assertTrue(self.warn(cmd="/bin/sh", project="/p"))
        self.assertTrue(self.warn(cmd="/bin/sh", pinned=True))
        self.assertEqual(self.warn(cmd="firefox", tabs=["https://a"]), [w for w in self.warn(cmd="firefox") if "tabs" in w])


if __name__ == "__main__":
    unittest.main()
