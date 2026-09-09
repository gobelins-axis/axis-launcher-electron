// Vendor
const path = require('path');
const { pathToFileURL } = require('url');
const { app } = require('electron');
const { ipcMain } = require('electron');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Managers
const WindowManager = require('./managers/WindowManager');
const ControllerManager = require('./managers/ControllerManager');
const CalibrationManager = require('./managers/CalibrationManager');
const LedManager = require('./managers/LedManager');
const AlternativeControllerManager = require('./managers/AlternativeControllerManager');

// Modules
const Mouse = require('./modules/Mouse');
const LeaderboardProxy = require('./modules/LeaderboardProxy');
const UsbWatcher = require('./modules/UsbWatcher');

// Utils
const getBoardPort = require('./utils/getBoardPort');

const BAUD_RATE = 28800;

// TEMP (dev only): open a tool instead of the menu at startup. Set all back to
// false before shipping. First true one wins, in this order.
const OPEN_CALIBRATION_ON_START = false;
const OPEN_LED_DEBUG_ON_START = false;
const OPEN_ALTERNATIVE_DEBUG_ON_START = true;

// Debug pages (src/led-debug, src/alternative-debug), loaded like a game. Only
// reachable through the toggles above, on purpose.
const LED_DEBUG_URL = pathToFileURL(path.join(__dirname, 'led-debug/index.html')).href;
const ALTERNATIVE_DEBUG_URL = pathToFileURL(path.join(__dirname, 'alternative-debug/index.html')).href;

function start(boardPort) {
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

    let controllerManager = null;

    if (boardPort) {
        const serialPort = new SerialPort({ path: boardPort, baudRate: BAUD_RATE });
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        controllerManager = new ControllerManager({
            app,
            serialPort,
            parser,
            windowManager,
            calibrationManager,
        });

        // LEDs: forwards axis-api's per-pixel lines to the board, clears on navigation.
        const ledManager = new LedManager({
            serialPort,
            parser,
            windowManager,
        });

        const mouse = new Mouse();
    }

    // Alternative controllers: any USB serial board plugged in while the
    // machine runs, accepted after a handshake (see the manager). Independent
    // of the main board so the debug page works on a dev machine without it.
    const usbWatcher = new UsbWatcher({ ignoredPaths: boardPort ? [boardPort] : [] });
    const alternativeControllerManager = new AlternativeControllerManager({
        usbWatcher,
        windowManager,
        controllerManager,
    });
    usbWatcher.start().catch((error) => console.error('USB watcher failed to start', error));

    leaderboardProxy.start();

    if (OPEN_CALIBRATION_ON_START) {
        calibrationManager.open();
    } else if (OPEN_LED_DEBUG_ON_START) {
        windowManager.openUrl(LED_DEBUG_URL);
    } else if (OPEN_ALTERNATIVE_DEBUG_ON_START) {
        windowManager.openUrl(ALTERNATIVE_DEBUG_URL);
    } else {
        windowManager.start();
    }
}

app.whenReady().then(() => {
    getBoardPort().then(
        (boardPort) => {
            start(boardPort);
        },
        (error) => {
            console.log(error);
            start();
        },
    );
});
