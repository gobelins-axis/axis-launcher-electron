// Vendor
const { app } = require('electron');
const { ipcMain } = require('electron');
const { getArduinoBoardPort } = require('utils');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Managers
const WindowManager = require('./managers/WindowManager');
const ControllerManager = require('./managers/ControllerManager');
const LedManager = require('./managers/LedManager');

// Modules
const Mouse = require('./modules/Mouse');
const LeaderboardProxy = require('./modules/LeaderboardProxy');

// TPM
const Server = require('./modules/Server');

const BAUD_RATE = 28800;

function start(arduinoPort) {
    const windowManager = new WindowManager({
        url: 'https://axis-launcher.netlify.app',
        // url: 'http://localhost:8000',
        // url: 'http://localhost:8080',
        // url: 'http://localhost:3003',
        width: 950,
        height: 950,
        preload: '../preload.js',
        ipcMain,
    });

    // windowManager.window.webContents.openDevTools();

    const leaderboardProxy = new LeaderboardProxy();

    if (arduinoPort) {
        const serialPort = new SerialPort({ path: arduinoPort, baudRate: BAUD_RATE });
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        const controllerManager = new ControllerManager({
            app,
            serialPort,
            parser,
            windowManager,
        });

        const ledManager = new LedManager({
            serialPort,
            parser,
        });

        const mouse = new Mouse();

        // TPM : Start local server
        const server = new Server({
            window: windowManager.window,
            serialPort,
        });
    }

    ledManager.start();
    leaderboardProxy.start();
    windowManager.start();
}

app.whenReady().then(() => {
    getArduinoBoardPort().then(
        (arduinoPort) => {
            start(arduinoPort);
        },
        (error) => {
            console.log(error);
            start();
        },
    );
});
