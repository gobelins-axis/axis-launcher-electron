const { app, BrowserWindow } = require('electron');
const { SerialPort } = require('serialport');
const { ipcMain } = require('electron');
require('dotenv').config();
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    win.loadURL('https://arcade-demo-game.netlify.app');

    win.webContents.openDevTools();

    win.once('ready-to-show', () => {
        win.show();
    });

    return win;
};

const createSerialPort = (win) => {
    const port = new SerialPort({ path: process.env.PORT, baudRate: 9600 });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (data) => {
        if (data.localeCompare('first') === 0) {
            win.webContents.send('keydown', 'a');
        }

        if (data.localeCompare('second') === 0) {
            win.webContents.send('keydown', 'b');
        }
    });

    return port;
};

app.whenReady().then(() => {
    const win = createWindow();
    createSerialPort(win);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
