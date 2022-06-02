class ControllerManager {
    constructor(options = {}) {
        // Props
        this._serialPort = options.serialPort;
        this._parser = options.parser;
        this._windowManager = options.windowManager;
        this._window = this._windowManager.window;

        // Setup
        this._bindAll();
        this._setupEventListeners();
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
        this._buttonHomeMessageReceivedHandler = this._buttonHomeMessageReceivedHandler.bind(this);
    }

    _setupEventListeners() {
        this._parser.on('data', this._messageReceivedHandler);
    }

    _messageReceivedHandler(data) {
        const messageData = this._getMessageData(data);

        if (messageData.type === 'joystick') this._joystickMessageReceivedHandler(messageData);
        if (messageData.type === 'button') this._buttonMessageReceivedHandler(messageData);
        if (messageData.type === 'button-home') this._buttonHomeMessageReceivedHandler(messageData);
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

    _buttonHomeMessageReceivedHandler(data) {
        console.log('Home', data);
        // if (this._windowManager.originalUrl === this._windowManager.url) return;
        this._window.webContents.send(`home:${data.state}`, {});
    }
}

module.exports = ControllerManager;
