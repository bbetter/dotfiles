"""Shared test plumbing: load hypr-sm into a sandbox (temp folders, no Hyprland needed)."""
import contextlib
import importlib.machinery
import importlib.util
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True   # importing the script must not write __pycache__ into the dotfiles
HYPR_SM = Path(__file__).resolve().parents[2] / "scripts/.local/bin/hypr-sm"

FAKE_MONITORS = [{"id": 0, "name": "DP-1", "x": 0, "y": 0, "width": 1920, "height": 1080, "scale": 1.0,
                  "focused": True, "activeWorkspace": {"id": 1, "name": "1"}},
                 {"id": 1, "name": "HDMI-1", "x": 1920, "y": 0, "width": 1920, "height": 1080, "scale": 1.0,
                  "focused": False, "activeWorkspace": {"id": 6, "name": "6"}}]


def client(address, cls, title="t", pid=1, ws=1, monitor=0, floating=False, **extra):
    """A window as `hyprctl -j clients` reports it."""
    c = {"address": address, "class": cls, "title": title, "pid": pid, "mapped": True,
         "workspace": {"id": ws, "name": str(ws)}, "monitor": monitor, "at": [7, 57], "size": [900, 600],
         "floating": floating, "fullscreen": 0, "pinned": False}
    c.update(extra)
    return c


class Sandbox:
    """A fresh hypr-sm module whose every path points into a temp folder."""

    ENV = ("HYPR_SM_PERSISTENT_DIR", "HYPR_SM_RECENT_DIR", "HYPR_SM_STATE_DIR", "HYPR_SM_CONFIG",
           "HYPR_SM_BINDS_FILE", "HYPR_SM_LAUNCHER_DIR", "HYPR_SM_NO_RELOAD", "HYPR_SM_ONLY_CLASS", "PATH")

    def __init__(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="hypr-sm-test-"))
        t = self.tmp
        for d in ("persistent", "recent", "state", "apps", "bin"):
            (t / d).mkdir()
        self._saved = {k: os.environ.get(k) for k in self.ENV}
        os.environ.update({
            "HYPR_SM_PERSISTENT_DIR": str(t / "persistent"), "HYPR_SM_RECENT_DIR": str(t / "recent"),
            "HYPR_SM_STATE_DIR": str(t / "state"), "HYPR_SM_CONFIG": str(t / "config.toml"),
            "HYPR_SM_BINDS_FILE": str(t / "binds.lua"), "HYPR_SM_LAUNCHER_DIR": str(t / "apps"),
            "HYPR_SM_NO_RELOAD": "1", "PATH": f"{t / 'bin'}:{os.environ.get('PATH', '')}"})
        os.environ.pop("HYPR_SM_ONLY_CLASS", None)
        name = f"hypr_sm_{id(self)}"
        loader = importlib.machinery.SourceFileLoader(name, str(HYPR_SM))
        spec = importlib.util.spec_from_loader(name, loader)
        self.sm = importlib.util.module_from_spec(spec)
        loader.exec_module(self.sm)
        self.sm.notify = lambda *a, **k: None
        self.clients = []
        self.sm.query = self._query

    def _query(self, what):
        if what == "clients":
            return list(self.clients)
        if what == "monitors":
            return [dict(m) for m in FAKE_MONITORS]
        return []

    def close(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        shutil.rmtree(self.tmp, ignore_errors=True)


class SmTestCase(unittest.TestCase):
    def setUp(self):
        self.box = Sandbox()
        self.sm = self.box.sm
        self.addCleanup(self.box.close)
        self.persistent = self.box.tmp / "persistent"
        self.recent = self.box.tmp / "recent"

    # -- helpers ---------------------------------------------------------------
    def run_cmd(self, fn, **kw):
        """Run a cmd_* function; returns its SmError message or None. Output is swallowed."""
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            try:
                fn(__import__("argparse").Namespace(**kw))
            except self.sm.SmError as e:
                return str(e)
        return None

    def json_of(self, fn, **kw):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            fn(__import__("argparse").Namespace(**kw))
        return json.loads(buf.getvalue())

    def write(self, obj, stem=None):
        """Create/edit a persistent session the way the GUI does (JSON on stdin)."""
        old = sys.stdin
        sys.stdin = io.StringIO(json.dumps(obj))
        try:
            return self.run_cmd(self.sm.cmd_write, stem=stem)
        finally:
            sys.stdin = old

    def session(self, name, *cmds, **extra):
        return {"name": name, "window": [{"cmd": c} for c in cmds or ("ghostty",)], **extra}

    def need_git(self):
        if not shutil.which("git"):
            self.skipTest("git not installed")
