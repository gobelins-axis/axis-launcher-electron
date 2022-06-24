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

[More infos](https://www.electronjs.org/docs/latest/tutorial/quick-start#package-and-distribute-your-application)

## Usage on the Axis Machine

If you import the packaged application on the machine and try to launch it by double clicking on the icon, it will not work properly (we don't really know why yet). What you need to do it launch it via the terminal by using : 

```bash
open -a axis-launcher.app
```

To make it a bit easier we created an apple script named "Axis Launcher" that you can find on the Desktop, you can double click that icon to launch the application. Make sure that there is no other axis lancher application on the Machine otherwise it could launch the wrong version.

## Update the application on the Axis Machine

Build the Application, import it to the Axis Machine application folder under the name axis-launcher.app. Make sure that no older version is still on the Axis machine. To test your updates, just launch the Apple Script (explained above).

## Authors

[@LPGeneret](https://twitter.com/LPGeneret)
[@sergebocancea](https://twitter.com/sergebocancea)
[@leochocolat](https://twitter.com/leochocolat)
