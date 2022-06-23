// Vendor
const { ipcMain } = require('electron');

class LedManager {
    constructor(options = {}) {
        // Props
        this._serialPort = options.serialPort;
        this._parser = options.parser;

        // Setup
        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Public
     */
    start() {
        this._serialPort.write('start\n');
    }

    /**
     * Private
     */
    _getMessageData(data) {
        const newData = {};
        const rows = data.split('__');
        rows.forEach(item => {
            const key = item.split(':')[0];
            const value = item.split(':')[1];
            if (key !== undefined && value !== undefined) newData[key] = value;
        });
        return newData;
    }

    _bindAll() {
        this._messageReceivedHandler = this._messageReceivedHandler.bind(this);
        this._setColorHandler = this._setColorHandler.bind(this);
    }

    _setupEventListeners() {
        this._parser.on('data', this._messageReceivedHandler);
        ipcMain.on('led:set', this._setColorHandler);
    }

    _messageReceivedHandler(data) {
        // console.log(data);
    }

    _setColorHandler(event, { data }) {
        this._serialPort.write(data, this._serialPortWriteHandler);
    }

    _serialPortWriteHandler(err) {
        if (err) console.log(err);
    }
}

module.exports = LedManager;
