const RESTART_TIMEOUT = 5000;
const INACTIVITY_TIMEOUT = 60000 * 10; // 10 Minutes
const JOYSTICK_INACTIVITY_THRESHOLD = 5;

class ControllerManager {
    constructor(options = {}) {
        // Props
        this._application = options.app;
        this._serialPort = options.serialPort;
        this._parser = options.parser;
        this._windowManager = options.windowManager;
        this._window = this._windowManager.window;

        // Setup
        this._joystickSignal1 = {};
        this._joystickSignal2 = {};
        this._isRestarting = false;
        this._isInactive = false;

        this._bindAll();
        this._setupEventListeners();
        this._poke();
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

    _poke() {
        clearTimeout(this._inactivityTimeout);
        this._inactivityTimeout = setTimeout(this._inactivityTimeoutHandler, INACTIVITY_TIMEOUT);

        if (this._isInactive) {
            this._isInactive = false;
            this._window.webContents.send('awake', {});
        }
    }

    _bindAll() {
        this._messageReceivedHandler = this._messageReceivedHandler.bind(this);
        this._buttonHomeMessageReceivedHandler = this._buttonHomeMessageReceivedHandler.bind(this);
        this._restartTimeoutCompletedHandler = this._restartTimeoutCompletedHandler.bind(this);
        this._inactivityTimeoutHandler = this._inactivityTimeoutHandler.bind(this);
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

        if (parseInt(data.id) === 1) {
            const deltaX = parseInt(data.x) - this._joystickSignal1.x;
            const deltaY = parseInt(data.y) - this._joystickSignal1.y;

            if (Math.abs(deltaX) > JOYSTICK_INACTIVITY_THRESHOLD || Math.abs(deltaY) > JOYSTICK_INACTIVITY_THRESHOLD) {
                this._poke();
            }

            this._joystickSignal1 = { x: parseInt(data.x), y: parseInt(data.y) };
        }

        if (parseInt(data.id) === 2) {
            const deltaX = parseInt(data.x) - this._joystickSignal2.x;
            const deltaY = parseInt(data.y) - this._joystickSignal2.y;

            if (Math.abs(deltaX) > JOYSTICK_INACTIVITY_THRESHOLD || Math.abs(deltaY) > JOYSTICK_INACTIVITY_THRESHOLD) {
                this._poke();
            }

            this._joystickSignal2 = { x: parseInt(data.x), y: parseInt(data.y) };
        }
    }

    _buttonMessageReceivedHandler(data) {
        this._window.webContents.send(data.state, {
            key: data.key,
            id: parseInt(data.id),
        });

        this._poke();
    }

    _buttonHomeMessageReceivedHandler(data) {
        if (data.state === 'keydown') this._buttonHomeKeydownHandler(data);
        if (data.state === 'keyup') this._buttonHomeKeyupHandler(data);

        this._poke();
    }

    _buttonHomeKeydownHandler() {
        clearTimeout(this._restartTimeout);
        this._restartTimeout = setTimeout(this._restartTimeoutCompletedHandler, RESTART_TIMEOUT);
    }

    _buttonHomeKeyupHandler(data) {
        if (this._isRestarting) return;
        clearTimeout(this._restartTimeout);
        if (this._windowManager.originalUrl === this._windowManager.url) return;
        this._window.webContents.send(`home:${data.state}`, {});
    }

    _restartTimeoutCompletedHandler() {
        this._isRestarting = true;
        this._application.relaunch();
        this._application.exit();
    }

    _inactivityTimeoutHandler() {
        this._isInactive = true;
        this._window.webContents.send('sleep', {});
        const sleep = this._windowManager.goToSleep();
        if (!sleep) this._poke();
    }
}

module.exports = ControllerManager;
