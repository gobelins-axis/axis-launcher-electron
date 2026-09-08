# Axis launcher (Electron)

Electron app running on the Axis arcade cabinet's Mac. It opens the controller
board's serial port, turns its lines into IPC events for the page loaded in the main
window (the menu at `axis-launcher.netlify.app`, then games), and hosts the joystick
calibration tool. The cross-repo picture and the shared contracts are in
`../CLAUDE.md`; firmware details in `../arduino/CLAUDE.md`.

## Run and build

- `npm install`, then `npm start` (electron-forge). Needs secret env files, ask the team.
- `npm run make` to package; on Apple Silicon: `npm run make -- --arch=x64 --platform=darwin`. On the cabinet the app must be started with `open -a axis-launcher.app` (see README).
- `arduino-cli` must be installed on the machine: the port is found through `arduino-cli board list` (`utils` package). Close the Arduino IDE serial monitor before launching, only one process can hold the port.
- Electron 17, `nodeIntegration: true`, `contextIsolation: false`: pages can `require('electron')` directly and the preload passes `ipcRenderer` to axis-api via `window.__axis__`.

## Architecture (`src/`)

- `main.js`: wires everything. `OPEN_CALIBRATION_ON_START` is a **temporary dev toggle** that opens the calibration page instead of the menu; set it back to `false` before shipping.
- `managers/WindowManager.js`: one fullscreen BrowserWindow. `openUrl(url)` loads a page like a game (also used by `url:changed` IPC); `exit` IPC and sleep reload the menu URL.
- `managers/ControllerManager.js`: parses serial lines (`type:...__key:...` split on `__` and `:`), forwards `keydown`/`keyup`/`joystick:move`/`home:keyup`, handles inactivity sleep and the Home long-press relaunch. Maps every joystick message through the calibration before sending, and also emits `joystick:raw`. Holding W+S of one controller for 3 s **on the menu only** opens the calibration page.
- `managers/CalibrationManager.js`: owns the stored calibration and the IPC surface (`calibration:open`, `calibration:get`, `calibration:apply`, `calibration:save`, `calibration:discard`). Drafts applied for preview are dropped whenever the window navigates away from the calibration page.
- `modules/JoystickCalibration.js`: pure mapping. Raw board values → -1..1 using centre/min/max per raw axis plus axis assignment and sign → the **legacy range games expect** (`x` 18..840, `y` 36..867, y inverted). Pass-through until calibrated. Storage: `app.getPath('userData')/joystick-calibration.json` (`~/Library/Application Support/axis-launcher/`), per machine and per macOS user. Pure enough to unit-test with plain Node.
- `calibration/`: the calibration tool page, loaded like a game (`file://` URL). Uses axis-api for buttons and the standard Home/exit flow, `ipcRenderer` directly for the raw stream and the calibration messages. Overview of both joysticks first (white dot = what games see, grey = raw), then per-joystick steps: rest centre, rotate for range, push right, push up (detects axis mapping and direction), live test through the real pipeline, save. Ships its own fonts (`fonts/`, the front's Darker Grotesque TTFs) and icons (`icons/`) so it works offline and inside the packaged app.
- `modules/Server.js`: local Express server on port 9999 used by the presentation ("TPM") flow to send `buildup1`/`buildup2`/`reveal`/`start` to the page and the board. Not for anything else; do not add HTTP routes for app features, use IPC.
- `modules/Mouse.js` (robotjs, joystick-as-mouse), `modules/LeaderboardProxy.js`, Firebase modules: untouched, pre-existing.

## Rules

- Never change the joystick numbers sent to the page outside `JoystickCalibration`: games embed old axis-api builds with the legacy constants baked in.
- Keep parsing on `\r\n` and baud 28800 in sync with the firmware.
- The calibration page follows the menu's design system (see `../CLAUDE.md`); indicators mirror the front's InputIndicator sizes exactly.
