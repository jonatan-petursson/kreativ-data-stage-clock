#!/usr/bin/env bash
# Stage Clock kiosk installer for Raspberry Pi OS (with desktop).
#
#   curl -fsSL __ORIGIN__/__ROOM__/rpi.sh | bash
#
# Run it once, as your normal user. It installs a launcher that opens the clock
# full screen at every login and restarts the browser if it ever exits.
# Re-run it with a different room to switch rooms.
set -euo pipefail

URL="__ORIGIN__/__ROOM__"
CONF="$HOME/.config/stage-clock"
LAUNCHER="$HOME/.local/bin/stage-clock-kiosk"

say() { printf '\033[1m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this as your normal desktop user, not root; it uses sudo where needed." >&2
  exit 1
fi
if [ ! -d /usr/share/wayland-sessions ] && [ ! -d /usr/share/xsessions ]; then
  echo "No desktop found. Use Raspberry Pi OS with desktop (not Lite)." >&2
  exit 1
fi

if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
  say "Installing Chromium"
  sudo apt-get update -qq
  sudo apt-get install -y -qq chromium || sudo apt-get install -y -qq chromium-browser
fi

if command -v raspi-config >/dev/null; then
  say "Enabling desktop autologin and disabling screen blanking"
  sudo raspi-config nonint do_boot_behaviour B4 || true
  sudo raspi-config nonint do_blanking 1 || true
fi

say "Installing launcher for $URL"
mkdir -p "$CONF" "$(dirname "$LAUNCHER")" "$HOME/.config/autostart"
echo "$URL" > "$CONF/url"

cat > "$LAUNCHER" <<'EOF'
#!/usr/bin/env bash
# Opens the Stage Clock full screen. The URL lives in ~/.config/stage-clock/url.
URL="$(cat "$HOME/.config/stage-clock/url")"
PROFILE="$HOME/.cache/stage-clock-chromium"
BROWSER="$(command -v chromium || command -v chromium-browser)"

# Only one copy, even if both autostart mechanisms fire.
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/stage-clock.lock"
flock -n 9 || exit 0

# Wait up to ~2 minutes for the network so the first load doesn't hit an error page.
for _ in $(seq 60); do
  curl -fsS -o /dev/null --max-time 3 "$URL" && break
  sleep 2
done

while true; do
  # After a power cut, don't show the "restore pages?" bubble.
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$PROFILE/Default/Preferences" 2>/dev/null || true
  "$BROWSER" --kiosk "$URL" \
    --user-data-dir="$PROFILE" \
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
    --no-first-run --password-store=basic --check-for-update-interval=31536000 \
    --ozone-platform-hint=auto
  sleep 3
done
EOF
chmod +x "$LAUNCHER"

cat > "$HOME/.config/autostart/stage-clock.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Stage Clock
Exec=$LAUNCHER
X-GNOME-Autostart-enabled=true
EOF

if [ -n "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ]; then
  say "Starting now"
  setsid "$LAUNCHER" >/dev/null 2>&1 < /dev/null &
else
  say "Done. Reboot to start the clock: sudo reboot"
fi

cat <<EOF

To stop it:       pkill -f stage-clock-kiosk; pkill chromium
To uninstall:     rm -r $CONF $LAUNCHER ~/.config/autostart/stage-clock.desktop
EOF
