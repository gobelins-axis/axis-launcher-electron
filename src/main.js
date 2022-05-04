const { app, BrowserWindow, BrowserView } = require('electron');
const { SerialPort } = require('serialport');
const { ipcMain } = require('electron');
require('dotenv').config();
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');
const { exec } = require('child_process');
const { getArduinoBoardPort } = require('utils');

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
            contextIsolation: false,
            enableRemoteModule: true,
        },
        acceptFirstMouse: true,
    });

    win.loadFile('index.html');

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
        console.log('clicked');
        win.loadURL('https://game.jahneration.com/');
    });

    // BACK TO HOME
    ipcMain.on('backToHome', (event) => {
        win.loadFile('../arcade-launcher-client/index.html');
    });

    win.webContents.on('did-finish-load', function() {
        console.log('finish load');
    });
    return win;
};

const createSerialPort = (win, arduinoPort) => {
    const port = new SerialPort({ path: arduinoPort, baudRate: 9600 });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (data) => {
        if (data.includes('buttonName:') && data.includes('buttonState:')) {
            const buttonName = data.split('_')[0].split(':')[1];
            const buttonState = data.split('_')[1].split(':')[1];
            win.webContents.send(buttonState, buttonName);
        }

        if (data.includes('joystickId:1') || data.includes('joystickId:2')) {
            const joystickId = parseInt(data.split('_')[0].split(':')[1]);
            const joystickX = data.split('_')[1].split(':')[1];
            const joystickY = data.split('_')[2].split(':')[1];

            const normalizedPosition = joystickNormalizedPosition(joystickX, joystickY);
            win.webContents.send('joystick:move', { joystickId, position: normalizedPosition });
        }
    });

    return port;
};

app.whenReady().then(() => {
    getArduinoBoardPort().then(
        (arduinoPort) => {
            const win = createWindow();
            createSerialPort(win, arduinoPort);
        },
        (error) => {
            console.log(error);
        },
    );
});

// Sur Windows, killer le process quand on ferme la fenêtre
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Sur macOS, quand on ferme la fenêtre le processus reste dans le dock
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


// JOYSTICK
const joystickNormalizedPosition = (x, y) => {
    const newX = map(x, 0, 1023, -1, 1);
    const newY = map(y, 0, 1023, -1, 1);
    const distanceFromCenter = distance(newX, newY, 0);
    if(distanceFromCenter < 0.02) {
        return {
            x: 0,
            y: 0,
        };
    }
    return {
        x: newX,
        y: newY,
    };
}

const map = (axisValue, in_min, in_max, out_min, out_max) => {
    return (axisValue - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }

const distance = (x, y, maxValue) => {  
    return (Math.sqrt((maxValue - x) * (maxValue - x)) + (maxValue - y) * (maxValue - y));
  }