const { app, BrowserWindow, BrowserView } = require('electron');
const { SerialPort } = require('serialport');
const { ipcMain } = require('electron');
require('dotenv').config();
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');

try {
    require('electron-reloader')(module);
} catch (_) {
}

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1500,
        height: 1200,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        acceptFirstMouse: true,
    });
    win.loadFile('../arcade-launcher-client/index.html');

    win.once('ready-to-show', () => {
        win.show();
    });

    const size = win.getSize();
    const firstView = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: false,
            enableRemoteModule: true,
        },
    }
    );
    firstView.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    firstView.setAutoResize({
        width: true,
        height: true,
        horizontal: true,
        vertical: true,
    });



    // SPACE VOYAGE
    ipcMain.on('voyageGame', (event) => {
        win.loadURL('https://space-voyage.mariusballot.com/');
    });

    // JAHNERATION
    ipcMain.on('jahGame', (event) => {
        console.log('clicked')
        win.loadURL('https://game.jahneration.com/');
    });

    // BACK TO HOME
    ipcMain.on('backToHome', (event) => {
        win.loadFile('../arcade-launcher-client/index.html');
    });

    win.webContents.on('did-finish-load', function() {
        console.log('finish load');
    });
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

// Sur Windows, killer le process quand on ferme la fenêtre
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Sur macOS, quand on ferme la fenêtre le processus reste dans le dock
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('colorClick', (event, data) => {
    setLedColor(data);
});

// Interact with arduino
const setLedColor = (color) => {
    port.write(color, (err) => {
        if (err) return console.log('Error on write: ', err.message);
        console.log('message written');
    });
};
