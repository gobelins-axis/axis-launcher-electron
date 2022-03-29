# 🚀 Arcade Launcher

Electron Application to lauch games on our Arcade Machine, the application is also handling the communication between our controllers and the game.

## Development

```bash
npm install
```

```bash
npm start
```

### Board communication

You will need to install Arduino CLI - [Install](https://arduino.github.io/arduino-cli/0.20/installation/)

Then run this command,

```bash
# Show devices connected to your computer
arduino-cli board list
```

and spot your arduino board port and FQBN (if detected) and add it to an environemnt file.
It should look like this

```env
PORT=/dev/cu.usbserial-14310
FQBN=arduino:avr:nano:cpu=atmega328old
```

If you cant find the FQBN, try to find it online by Arduino model / version...

### Build

```bash
npm run build
```

## Authors

[@LPGeneret](https://twitter.com/LPGeneret)
[@sergebocancea](https://twitter.com/sergebocancea)
[@leochocolat](https://twitter.com/leochocolat)
