// Vendor
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const BAUD_RATE = 9600;

class ControllerManager {
    constructor(options = {}) {
        // Props
        this._arduinoPort = options.arduinoPort;
        this._window = options.window;

        // Setup
        this._serialPort = this._createSerialPort();
        this._parser = this._createParser();

        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Private
     */
    _createSerialPort() {
        const serialPort = new SerialPort({ path: this._arduinoPort, baudRate: BAUD_RATE });
        return serialPort;
    }

    _createParser() {
        const parser = this._serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        return parser;
    }

    // BindAll
    _bindAll() {
        this._messageReceivedHandler = this._messageReceivedHandler.bind(this);
    }

    _setupEventListeners() {
        this._parser.on('data', this._messageReceivedHandler);
    }

    _messageReceivedHandler(data) {
        const messageData = this._getMessageData(data);

        if (messageData.type === 'joystick') this._joystickMessageReceivedHandler(messageData);
        if (messageData.type === 'button') this._buttonMessageReceivedHandler(messageData);
    }

    _joystickMessageReceivedHandler(data) {
        this._window.webContents.send('joystick:move', {
            id: parseInt(data.id),
            position: {
                x: parseInt(data.x),
                y: parseInt(data.y),
            },
        });
    }

    _buttonMessageReceivedHandler(data) {
        this._window.webContents.send(data.state, {
            key: data.key,
            id: parseInt(data.id),
        });
    }

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
}

module.exports = ControllerManager;
