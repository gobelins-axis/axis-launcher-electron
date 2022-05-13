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
        if (data.includes('buttonName:') && data.includes('buttonState:')) {
            const buttonName = data.split('_')[0].split(':')[1];
            const buttonState = data.split('_')[1].split(':')[1];
            this._window.webContents.send(buttonState, buttonName);
        }

        if (data.includes('id:1') || data.includes('id:2')) {
            const id = parseInt(data.split('_')[0].split(':')[1]);
            const joystickX = parseInt(data.split('_')[1].split(':')[1]);
            const joystickY = parseInt(data.split('_')[2].split(':')[1]);
            this._window.webContents.send('joystick:move', { id, position: { x: joystickX, y: joystickY } });
        }
    }
}

module.exports = ControllerManager;
