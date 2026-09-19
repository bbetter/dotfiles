"""Tiled layouts and workspace placement: pure logic, no windows needed."""
import unittest

from helpers import SmTestCase, client

W, H, G = 1906, 1016, 14   # a workspace and the gap between tiles


class TileTree(SmTestCase):
    def plan(self, rects):
        return self.sm.plan_tree(rects)

    def test_one_big_left_two_stacked_right(self):
        self.assertEqual(self.plan([(0, 0, 940, H), (940 + G, 0, 940, 500), (940 + G, 500 + G, 940, 502)]),
                         [(None, None), (0, True), (1, False)])

    def test_two_stacked_left_one_right(self):
        self.assertEqual(self.plan([(0, 0, 940, 500), (0, 500 + G, 940, 502), (940 + G, 0, 940, H)]),
                         [(None, None), (0, True), (0, False)])

    def test_three_columns_and_a_grid(self):
        self.assertEqual(self.plan([(0, 0, 600, H), (614, 0, 600, H), (1228, 0, 678, H)]),
                         [(None, None), (0, True), (1, True)])
        self.assertEqual(self.plan([(0, 0, 940, 500), (954, 0, 940, 500), (0, 514, 940, 502), (954, 514, 940, 502)]),
                         [(None, None), (0, True), (0, False), (1, False)])

    def test_a_pinwheel_is_not_a_guillotine_layout(self):
        pinwheel = [(0, 0, 600, 300), (600, 0, 300, 600), (300, 300, 600, 300), (0, 300, 300, 600)]
        self.assertIsNone(self.plan(pinwheel))
        self.assertIsNone(self.sm.shape_sig(pinwheel))

    def test_shape_signature_ignores_sizes_but_not_structure(self):
        a = self.sm.shape_sig([(0, 0, 100, H), (114, 0, 800, 300), (114, 314, 800, 700)])
        b = self.sm.shape_sig([(0, 0, 900, H), (914, 0, 500, 100), (914, 114, 500, 900)])
        c = self.sm.shape_sig([(0, 0, 940, 500), (0, 514, 940, 502), (954, 0, 940, H)])   # mirrored structure
        self.assertEqual(a, b)
        self.assertNotEqual(a, c)


class Placement(SmTestCase):
    MON = {"primary": "DP-1", "secondary": "HDMI-1"}
    CANDS = {"DP-1": [1, 2, 3, 4, 5], "HDMI-1": [6, 7, 8, 9, 10]}

    def test_exact_uses_saved_workspace_else_what_the_monitor_shows(self):
        wins = [{"monitor": "primary", "workspace": 4}, {"monitor": "primary"}, {"monitor": "secondary"}]
        self.assertEqual(self.sm.plan_exact(wins, {"primary": 2, "secondary": 7}, self.CANDS, self.MON), [4, 2, 7])

    def test_exact_falls_back_to_the_first_workspace_of_the_monitor(self):
        self.assertEqual(self.sm.plan_exact([{"monitor": "secondary"}], {}, self.CANDS, self.MON), [6])

    def test_free_gives_each_saved_workspace_its_own_empty_one(self):
        wins = [{"monitor": "primary", "workspace": 3}, {"monitor": "primary", "workspace": 3},
                {"monitor": "primary", "workspace": 5}, {"monitor": "secondary", "workspace": 8}]
        placed, warns = self.sm.plan_free(wins, self.CANDS, self.MON, busy={1, 2, 6})
        self.assertEqual(placed, [3, 3, 4, 7])   # 1,2,6 are busy; saved 3->3, 5->4; secondary 8->7
        self.assertEqual(warns, [])

    def test_free_warns_and_shares_when_workspaces_run_out(self):
        wins = [{"monitor": "primary", "workspace": 1}, {"monitor": "primary", "workspace": 2}]
        placed, warns = self.sm.plan_free(wins, {"DP-1": [1, 2], "HDMI-1": [6]}, self.MON, busy={1})
        self.assertEqual(placed, [2, 2])
        self.assertTrue(warns)


class Summaries(SmTestCase):
    def test_terminal_programs_reported_per_process(self):
        items = [(0, client("a", "com.mitchellh.ghostty", pid=1), {}, ""), (1, client("b", "com.mitchellh.ghostty", pid=1), {}, ""),
                 (2, client("c", "google-chrome", pid=2), {}, "")]
        out = self.sm.terminal_programs(items, kids=lambda pid: {1: [10], 10: [11]}.get(pid, []), comm=lambda p: {11: "claude"}.get(p, ""))
        self.assertEqual(out, [("com.mitchellh.ghostty", ["claude"])])   # once, though two windows share the process

    def test_closing_summary_counts_by_class(self):
        items = [(0, client("a", "foot"), {}, ""), (1, client("b", "foot"), {}, ""), (2, client("c", "firefox"), {}, "")]
        head, warns = self.sm.closing_summary(items, [("foot", ["vim"])])
        self.assertEqual(head, "2x foot, 1x firefox")
        self.assertEqual(warns, ["foot is running: vim (lost if closed)"])


if __name__ == "__main__":
    unittest.main()
