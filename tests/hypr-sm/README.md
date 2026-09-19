# hypr-sm tests

Standard library only. From the dotfiles root:

    PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/hypr-sm   # 100+ sandboxed tests, ~2 s, no Hyprland needed

| file | covers |
|---|---|
| `test_launch.py` | launch lines (ghostty cwd, browser tabs, terminal `run`, IDE project), validation, warnings |
| `test_store.py` | persistent vs recent, unique names, persist/rename/duplicate/delete, git backup + restore, autosave history, login prompt, hotkeys, launcher entries, update/diff |
| `test_capture.py` | terminal cwd, Chrome (synthetic SNSS files) and Firefox (LZ4) tabs, IDE projects, what can't be saved |
| `test_layout.py` | tile-tree planning, workspace placement, summaries |

Every test runs against throwaway folders (`HYPR_SM_*` environment overrides) and a fake `hyprctl` answer,
so nothing here touches your real sessions, config, launcher entries or windows.

## Opt-in live tests (need a running Hyprland)

    HYPR_SM_LIVE=1     python3 -m unittest discover -s tests/hypr-sm -p "test_live.py" -v
    HYPR_SM_LIVE_GUI=1 python3 -m unittest discover -s tests/hypr-sm -p "test_gui.py"  -v

They open throwaway `ghostty --class=com.hyprsmtest.*` windows for a few seconds and close them.
`hypr-sm` is fenced with `HYPR_SM_ONLY_CLASS`, so Replace can only ever see those windows; your own
windows are never closed. The GUI test starts a separate AGS instance (your bar is not restarted)
and removes its driver from `~/.config/ags` afterwards.

`gui/app-sessions-test.ts` is that driver: it finds real widgets and emits their real signals
(there is no input-synthesis tool on this machine). It is also handy interactively:
`ags request -i hyprsm-test dump`, `... click "Save"`, `... cardbtn "Name | Edit"`.
