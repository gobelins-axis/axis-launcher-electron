// Vendor
const { app } = require('electron');
const { ipcMain } = require('electron');
const { getArduinoBoardPort } = require('utils');

// Managers
const WindowManager = require('./managers/WindowManager');
const ControllerManager = require('./managers/ControllerManager');
const Mouse = require('./modules/Mouse');

// Environment variables
require('dotenv').config();

function start(arduinoPort) {
    const windowManager = new WindowManager({
        // url: 'https://arcade-launcher-client.netlify.app',
        url: 'http://localhost:3003',
        width: 1500,
        height: 1200,
        preload: '../preload.js',
        ipcMain,
    });

    if (arduinoPort) {
        const controllerManager = new ControllerManager({
            arduinoPort,
            window: windowManager.window,
        });

        const mouse = new Mouse();
    }

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
