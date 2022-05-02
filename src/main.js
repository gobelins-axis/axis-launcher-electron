const { app, BrowserWindow, BrowserView } = require('electron');
const { SerialPort } = require('serialport');
const { ipcMain } = require('electron');
require('dotenv').config();
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');
const { exec } = require('child_process');

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
};

const createSerialPort = (win, arduinoPort) => {
    const port = new SerialPort({ path: arduinoPort, baudRate: 9600 });
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
    getBoardList().then((response) => {
        const arduinoPort = getArduinoPort(response);

        if (!arduinoPort) {
            console.error('❌ Couldnt find any arduino board connected through USB');
            return;
        }

        console.log(`✅ Board founded on port ${arduinoPort}!\n`);

        const win = createWindow();
        createSerialPort(win, arduinoPort);
    });
});

// Get Board list
const getBoardList = () => {
    // Find arduino port
    const promise = new Promise((resolve, reject) => {
        console.log('⏳ Getting board list...');
        exec('arduino-cli board list', (error, stdout, stderr) => {
            if (error) { reject(Error('❌ Something went wrong while getting board list')); }
            resolve(stdout);
        });
    });

    return promise;
};

const getArduinoPort = (boardList) => {
    const lines = boardList.split('\n');

    const ports = lines.filter((item) => {
        return item.includes('Serial Port');
    });

    const usbPorts = ports.filter((item) => {
        return item.includes('Serial Port (USB)');
    });

    if (usbPorts.length === 0) return;

    const port = usbPorts[0].split(' ')[0];

    return port;
};

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
