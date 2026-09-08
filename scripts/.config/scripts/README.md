# Theme pipeline

Палітра з поточної шпалери розповзається по всьому десктопу: бар/сайдбар (AGS),
wofi, fuzzel, Hyprland (бордери/тіні/groupbar), swaync, swaylock, hyprlock,
ghostty, fastfetch.

## Потік

```
wall (linux-wallpaperengine)         зміна шпалери
  │
  ▼
theme-watcher.sh        цикл 1с: стежить за `wall status` (id на DP-2) і
  │                     ~/.config/theme/current_mode; на зміну → apply-theme.sh
  ▼
apply-theme.sh          MODE=dynamic → wal -i <preview кадр> --backend colorz
  │                     MODE=static  → wal --theme <name>
  │                     далі: gen-theme.sh, потім `hyprctl reload`
  ▼
gen-theme.sh            читає ~/.cache/wal/colors → підставляє в *.template.*
  │                     → пише реальні конфіги → перезавантажує споживачів
  ▼
swaync-client -rs · pkill -USR2 ghostty · ags reload · hyprctl reload
```

`~/.cache/wal/colors` — 16 рядків `#rrggbb`. gen-theme бере: `1=bg 2=error
4=special 5=primary 6=secondary 7=success 8=fg` (ghostty бере всі 16 як palette).

## Як додати нового споживача

1. **Шаблон.** Поряд із реальним конфігом застосунку створити
   `<name>.template.<ext>` з токенами `__PLACEHOLDER__` замість кольорів.
   Приклад: `~/.config/swaync/style.template.css` → генерує `style.css`.

2. **Реєстрація.** У `gen-theme.sh`, секція `# застосування`:
   ```sh
   generate "$HOME/.config/<app>/<name>.template.<ext>" \
     "$HOME/.config/<app>/<name>.<ext>"
   ```
   `generate()` мовчки пропускає відсутній шаблон (`[ -f ] || return 0`).

3. **Reload (якщо треба).** Секція `# reload the rest` — додати сигнал/команду,
   напр. `pkill -USR2 <app>` або `<app> --reload`.

4. **Новий формат токена (якщо існуючих не вистачає).** У `gen-theme.sh`:
   - обчислити змінну поряд із `PRIMARY_ANSI=…`
   - додати рядок у `sed` всередині `generate()`:
     `-e "s/__MY_TOKEN__/$MY_VALUE/g" \`
   Хелпери вже є: `strip` (прибрати `#`), `to_rgba` (→ `rrggbbff`),
   `hex_to_rgba_css $hex $alpha` (→ `rgba(r,g,b,a)`), `hex_to_ansi` (→ `38;2;r;g;b`).

5. **Тест.**
   ```sh
   bash ~/.config/scripts/gen-theme.sh > /dev/null 2>&1   # НЕ пайпити в head/tail!
   grep -n '__[A-Z_]*__' ~/.config/<app>/<name>.<ext>     # має бути порожньо
   ```
   ⚠️ `gen-theme.sh` наприкінці робить `ags run & disown` — фоновий процес
   тримає stdout відкритим, тож `gen-theme.sh | tail` зависає назавжди.
   Завжди `> /dev/null` або `> file`.

6. **Git.** Закомітити шаблон (і згенерований вихід, якщо трекаєш — так у репо
   вже зроблено для `ags/style.scss`, `wofi/style.css`, `swaync/style.css`)
   у stow-пакет `scripts` або відповідний пакет застосунку.

## Токени

| Токен | Формат | Приклад |
|---|---|---|
| `__BG__` `__FG__` | `rrggbb` (без `#`) | `1c2023` |
| `__FG_CSS__` | `#rrggbb` | `#c7ccd1` |
| `__PRIMARY__` `__SECONDARY__` `__ERROR__` `__SUCCESS__` `__SPECIAL__` `__WARNING__` `__ALERT__` | `#rrggbb` | `#ae95c7` |
| `__PRIMARY_HEX__` `__SECONDARY_HEX__` `__SUCCESS_HEX__` `__ERROR_HEX__` | `rrggbb` | `ae95c7` |
| `__BG_ALPHA__` `__BG_STRONG__` `__BG_POPUP__` `__BG_SIDEBAR__` | `rgba(r,g,b,a)` — 0.85/0.95/0.97/0.98 | `rgba(28,32,35,0.85)` |
| `__PRIMARY_A10__` `__PRIMARY_A20__` `__PRIMARY_A30__` `__PRIMARY_A50__` `__FG_DIM__` | `rgba(r,g,b,a)` | `rgba(174,149,199,0.1)` |
| `__PRIMARY_RGBA__` `__SECONDARY_RGBA__` `__INACTIVE_RGBA__` | `rrggbbff` (формат Hyprland `rgba()`) | `ae95c7ff` |
| `__PRIMARY_ANSI__` `__SECONDARY_ANSI__` `__FG_ANSI__` | `38;2;r;g;b` (24-bit ANSI) | `38;2;174;149;199` |

`WARNING` = `secondary`, `ALERT` = `error`, `INACTIVE_RGBA` = `bg` — синоніми.

## Споживачі (станом на 2026-09)

| Файл | Шаблон | Reload |
|---|---|---|
| `theme/hyprland-colors.lua` | `.template.lua` | `hyprctl reload` (в apply-theme) — `look.lua` робить `dofile` останнім |
| `wofi/style.css` | `.template.css` | — (читається щоразу) |
| `fuzzel/fuzzel.ini` | `.template.ini` | — |
| `ags/style.scss` | `.template.scss` | `ags request reload` + рестарт (в gen-theme) |
| `swaync/style.css` | `.template.css` | `swaync-client -rs` |
| `swaylock/config` | `config.template` | — (читається на лок) |
| `hypr/hyprlock.conf` | `.template.conf` | — |
| `fastfetch/config.jsonc` | `.template.jsonc` | — |
| `ghostty/theme-wal` | (не шаблон — пряма генерація палітри) | `pkill -USR2 ghostty` |

## Файли

- `theme-watcher.sh` — демон (запуск з `autostart.lua`)
- `apply-theme.sh` — one-shot: wal + gen-theme + hyprctl reload
- `gen-theme.sh` — рендер шаблонів + перезавантаження
- `theme-menu.sh` — fuzzel-меню вибору теми (бінд `SUPER+F1` / `SUPER+Y`)
- `set-theme-mode.sh` — перемикач dynamic/static (`~/.config/theme/current_mode`)
