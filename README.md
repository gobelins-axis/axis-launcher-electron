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

Spot your arduino board and store the FQBN (if detected) somewhere, you'll need it soon.
If it's marked as Unknown, try to find it online by Arduino model / version or use this command :

```bash
arduino-cli board listall mkr
```

```env
FQBN=arduino:avr:nano:cpu=atmega328old
```

### Build

```bash
npm run build
```

## Authors

[@LPGeneret](https://twitter.com/LPGeneret)
[@sergebocancea](https://twitter.com/sergebocancea)
[@leochocolat](https://twitter.com/leochocolat)
