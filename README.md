# 🚀 Axis Launcher

Electron Application to lauch games on our Axis Machine, the application is also handling the communication between our controllers and the game.

## Dependencies

-   Node.js - [Install](https://nodejs.org/en/download/)
-   Arduino CLI - [Install](https://arduino.github.io/arduino-cli/0.20/installation/)

## Installing

### Create a configuration file

```bash
arduino-cli config init
```

### Connect the board to your PC

```bash
# Update the local cache of available platforms and libraries
arduino-cli core update-index
```

On MacOS, If your board is connected to your computer the arduino port should be automatically detected.

## Development

```bash
npm install
```

```bash
npm start
```

You will need some secret environment files to make it work, get in touch with the Axis team to have access to them.

## Build

```bash
npm run make
```

If you're using a ARM64 machine you need to specify the arch x64 in the command line like so :

```bash
npm run make -- --arch=x64 --platform=darwin
```

[More infos](https://www.electronjs.org/docs/latest/tutorial/quick-start#package-and-distribute-your-application)

## Usage on the Axis Machine

If you import the packaged application on the machine and try to launch it by double clicking on the icon, it will not work properly (we don't really know why yet). What you need to do it launch it via the terminal by using : 

```bash
open -a axis-launcher.app
```

To make it a bit easier we created an Automator App named "Axis Launcher Helper" that you can find on the Desktop, you can double click that app to launch the application. Make sure that there is no other axis lancher application on the Machine otherwise it could launch the wrong version.

## Update the application on the Axis Machine

Build the Application, import it to the Axis Machine application folder under the name axis-launcher.app. Make sure that no older version is still on the Axis machine. To test your updates, just launch the "Axis Launcher Helper" application (explained above).

## Joystick calibration

The board sends raw analog values. The launcher converts them, in `src/managers/ControllerManager.js`, to the range every game expects from `axis-api` (`x` 18..840, `y` 36..867), using a per-machine calibration. Until a joystick has been calibrated its values are passed through unchanged.

The calibration tool is a page shipped with the launcher (`src/calibration`) and loaded in the main window like a game. It walks through joystick 1 then 2 (a stick that is not wired can be skipped), using the arcade buttons: **A** confirm, **X** restart the current joystick, **S** skip, **Home** exit like any game.

Open it either by:

-   holding **W and S** of the same controller for 3 seconds,
-   or, from the menu web app, sending the IPC message `calibration:open` (`ipcRenderer.send('calibration:open')`).

The result is stored in the app's user data folder as `joystick-calibration.json` (on macOS: `~/Library/Application Support/axis-launcher/`). Delete that file to go back to pass-through.

## Authors

[@LPGeneret](https://twitter.com/LPGeneret)
[@sergebocancea](https://twitter.com/sergebocancea)
[@leochocolat](https://twitter.com/leochocolat)
