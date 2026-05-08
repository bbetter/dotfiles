#!/bin/bash

# ======================================================================================
# MRK HYPRLAND INSTALLER/UPDATER
# ======================================================================================

CONFIG_DIR="$HOME/.config/hypr"
CONFIG_FILE="$CONFIG_DIR/hyprland.conf"
BACKUP_FILE="$CONFIG_DIR/hyprland.conf.bak"

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    MISSING=()
    
    # Critical apps
    command -v fuzzel >/dev/null 2>&1 || MISSING+=("fuzzel")
    command -v thunar >/dev/null 2>&1 || MISSING+=("thunar")
    command -v swaybg >/dev/null 2>&1 || MISSING+=("swaybg")
    
    # Terminal check
    TERMINAL=$(detect_terminal)
    if [ "$TERMINAL" == "xterm" ]; then
        echo -e "${YELLOW}Warning: No modern terminal (foot/kitty) detected.${NC}"
        MISSING+=("foot")
    fi

    if [ ${#MISSING[@]} -ne 0 ]; then
        echo -e "${YELLOW}The following apps are recommended but missing: ${MISSING[*]}${NC}"
        echo -e "You can install them with:"
        echo -e "${GREEN}sudo apt update && sudo apt install ${MISSING[*]}${NC}"
        echo ""
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

detect_terminal() {
    for term in foot kitty alacritty gnome-terminal; do
        if command -v "$term" >/dev/null 2>&1; then
            echo "$term"
            return
        fi
    done
    echo "xterm"
}

setup_monitors() {
    echo -e "${BLUE}Detecting monitors...${NC}"
    if ! command -v hyprctl >/dev/null 2>&1; then
        echo -e "${YELLOW}hyprctl not found or Hyprland not running. Skipping auto-detection.${NC}"
        MONITOR_CONF="monitor = ,preferred,auto,1"
        return
    fi

    MAPFILE=($(hyprctl monitors | grep "Monitor" | awk '{print $2}'))
    COUNT=${#MAPFILE[@]}

    if [ "$COUNT" -eq 0 ]; then
        MONITOR_CONF="monitor = ,preferred,auto,1"
    elif [ "$COUNT" -eq 1 ]; then
        echo "Detected one monitor: ${MAPFILE[0]}"
        MONITOR_CONF="monitor = ${MAPFILE[0]}, preferred, auto, 1"
    else
        echo -e "${GREEN}Detected $COUNT monitors:${NC}"
        for i in "${!MAPFILE[@]}"; do
            echo "$((i+1))) ${MAPFILE[$i]}"
        done
        
        echo -e "${YELLOW}Which monitor should be VERTICAL? (Enter number, or 0 for none):${NC}"
        read -r CHOICE
        
        MONITOR_CONF=""
        WORKSPACE_CONF=""
        
        if [[ "$CHOICE" -gt 0 && "$CHOICE" -le "$COUNT" ]]; then
            VERT_INDEX=$((CHOICE-1))
            VERT_NAME=${MAPFILE[$VERT_INDEX]}
            
            # Setup horizontal monitors first
            OFFSET=0
            for i in "${!MAPFILE[@]}"; do
                if [ "$i" -ne "$VERT_INDEX" ]; then
                    NAME=${MAPFILE[$i]}
                    MONITOR_CONF+="monitor = $NAME, preferred, ${OFFSET}x0, 1\n"
                    WORKSPACE_CONF+="workspace = 1, monitor:$NAME\n"
                    OFFSET=$((OFFSET + 1920)) # Guessing width, Hyprland handles auto mostly
                fi
            done
            
            # Setup vertical monitor
            MONITOR_CONF+="monitor = $VERT_NAME, preferred, ${OFFSET}x0, 1, transform, 1"
            WORKSPACE_CONF+="workspace = 6, monitor:$VERT_NAME"
        else
            MONITOR_CONF="monitor = ,preferred,auto,1"
        fi
    fi
}

setup_wallpaper() {
    echo -e "${BLUE}Setup Wallpaper?${NC}"
    read -p "Enter full path to wallpaper image (or press Enter to skip): " WP_PATH
    if [ -n "$WP_PATH" ] && [ -f "$WP_PATH" ]; then
        WALLPAPER_CMD="exec-once = swaybg -i $WP_PATH -m fill"
    else
        WALLPAPER_CMD="# exec-once = swaybg -i /path/to/wallpaper -m fill"
    fi
}

update_config() {
    check_dependencies
    setup_monitors
    setup_wallpaper
    TERMINAL=$(detect_terminal)

    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${BLUE}Backing up existing config to $BACKUP_FILE${NC}"
        cp "$CONFIG_FILE" "$BACKUP_FILE"
    fi

    echo -e "${BLUE}Applying new Hyprland configuration...${NC}"
    
    # Use a temporary file to build the config
    cat <<EOF > "$CONFIG_FILE"
# ======================================================================================
# HYPRLAND CONSOLIDATED CONFIG (mrk version)
# ======================================================================================

# ============================
# ENVIRONMENT
# ============================
env = XDG_CURRENT_DESKTOP,Hyprland
env = XDG_SESSION_TYPE,wayland
env = QT_QPA_PLATFORM,wayland
env = HYPRCURSOR_SIZE,24

# ============================
# MONITORS
# ============================
$(echo -e "$MONITOR_CONF")

# ============================
# WORKSPACE MONITOR BINDING
# ============================
$(echo -e "$WORKSPACE_CONF")

# ============================
# APPLICATIONS (Simplified)
# ============================
\$terminal = $TERMINAL
\$menu = fuzzel
\$fileManager = thunar

# ============================
# AUTOSTART
# ============================
exec-once = dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
exec-once = systemctl --user import-environment WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
exec-once = /usr/lib/polkit-kde-authentication-agent-1
$WALLPAPER_CMD

# ============================
# INPUT
# ============================
input {
    kb_layout = us,ua
    kb_options = grp:alt_shift_toggle
    follow_mouse = 1
    sensitivity = 0
}

gesture = 3, horizontal, workspace

# ============================
# LOOK & FEEL
# ============================
general {
    gaps_in = 4
    gaps_out = 4
    border_size = 3
    col.active_border = rgba(c39e74ff) rgba(d2b898ff) 45deg
    col.inactive_border = rgba(21170fff)
    layout = dwindle
}

decoration {
    rounding = 8
    shadow {
        enabled = true
        range = 4
        render_power = 3
        color = rgba(c39e74ee)
    }
    blur {
        enabled = yes
        size = 3
        passes = 1
    }
}

animations {
    enabled = yes
    bezier = easeOutQuint, 0.23, 1, 0.32, 1
    animation = windows, 1, 4.5, easeOutQuint
    animation = workspaces, 1, 2.2, default
}

dwindle {
    pseudotile = true
    preserve_split = true
}

misc {
    force_default_wallpaper = 0
    disable_hyprland_logo = true
}

# ============================
# WINDOW RULES
# ============================
windowrule = suppress_event maximize, match:class .*
windowrule = float on, match:class ^(polkit-.*)$
windowrule = center on, match:class ^(polkit-.*)$

# ==================================================
# KEYBINDS
# ==================================================
\$mainMod = SUPER

bind = \$mainMod, Q, killactive
bind = \$mainMod SHIFT, Q, exit

# LAUNCHERS
bind = \$mainMod, SPACE, exec, \$menu
bind = \$mainMod, RETURN, exec, \$terminal
bind = \$mainMod, E, exec, \$fileManager

# NAVIGATION
bind = \$mainMod, left,  movefocus, l
bind = \$mainMod, right, movefocus, r
bind = \$mainMod, up,    movefocus, u
bind = \$mainMod, down,  movefocus, d

# WORKSPACES
bind = \$mainMod, 1, workspace, 1
bind = \$mainMod, 2, workspace, 2
bind = \$mainMod, 3, workspace, 3
bind = \$mainMod, 4, workspace, 4
bind = \$mainMod, 5, workspace, 5
bind = \$mainMod, 6, workspace, 6
bind = \$mainMod, 7, workspace, 7
bind = \$mainMod, 8, workspace, 8
bind = \$mainMod, 9, workspace, 9
bind = \$mainMod, 0, workspace, 10

bind = \$mainMod SHIFT, 1, movetoworkspace, 1
bind = \$mainMod SHIFT, 2, movetoworkspace, 2
bind = \$mainMod SHIFT, 3, movetoworkspace, 3
bind = \$mainMod SHIFT, 4, movetoworkspace, 4
bind = \$mainMod SHIFT, 5, movetoworkspace, 5
bind = \$mainMod SHIFT, 6, movetoworkspace, 6
bind = \$mainMod SHIFT, 7, movetoworkspace, 7
bind = \$mainMod SHIFT, 8, movetoworkspace, 8
bind = \$mainMod SHIFT, 9, movetoworkspace, 9
bind = \$mainMod SHIFT, 0, movetoworkspace, 10

# MOUSE
bindm = \$mainMod, mouse:272, movewindow
bindm = \$mainMod, mouse:273, resizewindow
EOF

    echo -e "${GREEN}Done! Configuration updated.${NC}"
    echo -e "You may need to press ${YELLOW}SUPER+SHIFT+Q${NC} to restart Hyprland or ${YELLOW}hyprctl reload${NC}."
}

rollback_config() {
    if [ -f "$BACKUP_FILE" ]; then
        echo -e "${BLUE}Rolling back to $BACKUP_FILE${NC}"
        cp "$BACKUP_FILE" "$CONFIG_FILE"
        echo -e "${GREEN}Rollback complete.${NC}"
    else
        echo -e "${RED}Error: Backup file $BACKUP_FILE not found.${NC}"
    fi
}

case "$1" in
    update)
        update_config
        ;;
    rollback)
        rollback_config
        ;;
    *)
        echo "Usage: $0 {update|rollback}"
        exit 1
        ;;
esac
