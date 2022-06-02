// Environment variables
require('dotenv').config();

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

const BAUD_RATE = 28800;
// const BAUD_RATE = 9600;

function start(arduinoPort) {
    const windowManager = new WindowManager({
        // url: 'https://axis-launcher-front.netlify.app',
        // url: 'http://localhost:8000',
        // url: 'http://localhost:8080',
        url: 'http://localhost:3003',
        width: 950,
        height: 950,
        preload: '../preload.js',
        ipcMain,
    });

    windowManager.window.webContents.openDevTools();

    const leaderboardProxy = new LeaderboardProxy();

    if (arduinoPort) {
        const serialPort = new SerialPort({ path: arduinoPort, baudRate: BAUD_RATE });
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        const controllerManager = new ControllerManager({
            serialPort,
            parser,
            windowManager,
        });

        const ledManager = new LedManager({
            serialPort,
            parser,
        });

        const mouse = new Mouse();
    }

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

// Sur macOS, quand on ferme la fenêtre le processus reste dans le dock
// app.on('activate', () => {
//     console.log('windows closed 2');
//     if (BrowserWindow.getAllWindows().length === 0) createWindow();
// });
