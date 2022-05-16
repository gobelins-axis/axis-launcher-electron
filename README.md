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

## Build

```bash
npm run make
```

[More infos](https://www.electronjs.org/docs/latest/tutorial/quick-start#package-and-distribute-your-application)

## Authors

[@LPGeneret](https://twitter.com/LPGeneret)
[@sergebocancea](https://twitter.com/sergebocancea)
[@leochocolat](https://twitter.com/leochocolat)
