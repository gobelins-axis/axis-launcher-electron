// Vendor
const { app } = require('electron');
const { ipcMain } = require('electron');
const { getArduinoBoardPort } = require('utils');

// Managers
const WindowManager = require('./WindowManager');
const ControllerManager = require('./ControllerManager');

// Environment variables
require('dotenv').config();

function start(arduinoPort) {
    const windowManager = new WindowManager({
        url: 'https://arcade-launcher-client.netlify.app',
        width: 1500,
        height: 1200,
        preload: './preload.js',
        ipcMain,
    });

    const controllerManager = new ControllerManager({
        arduinoPort,
        window: windowManager.window,
    });

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
