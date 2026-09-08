// Vendor
const { app } = require('electron');
const { ipcMain } = require('electron');
const { getArduinoBoardPort } = require('utils');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Managers
const WindowManager = require('./managers/WindowManager');
const ControllerManager = require('./managers/ControllerManager');
const CalibrationManager = require('./managers/CalibrationManager');
// const LedManager = require('./managers/LedManager');

// Modules
const Mouse = require('./modules/Mouse');
const LeaderboardProxy = require('./modules/LeaderboardProxy');

// TPM
const Server = require('./modules/Server');

const BAUD_RATE = 28800;

// TEMP (dev only): open the joystick calibration tool instead of the menu at
// startup. Set back to false before shipping.
const OPEN_CALIBRATION_ON_START = true;

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

    // Joystick calibration page + per-machine storage (see src/calibration).
    // Created even without a board so the page can be opened for UI work.
    const calibrationManager = new CalibrationManager({ windowManager });

    if (arduinoPort) {
        const serialPort = new SerialPort({ path: arduinoPort, baudRate: BAUD_RATE });
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        const controllerManager = new ControllerManager({
            app,
            serialPort,
            parser,
            windowManager,
            calibrationManager,
        });

        // const ledManager = new LedManager({
        //     serialPort,
        //     parser,
        // });

        const mouse = new Mouse();

        // TPM : Start local server
        const server = new Server({
            window: windowManager.window,
            serialPort,
        });

        // ledManager.start();
    }

    leaderboardProxy.start();

    if (OPEN_CALIBRATION_ON_START) {
        calibrationManager.open();
    } else {
        windowManager.start();
    }
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
