const RESTART_TIMEOUT = 5000;
const INACTIVITY_TIMEOUT = 60000 * 10; // 10 Minutes
const JOYSTICK_INACTIVITY_THRESHOLD = 5;
// Hold W and S of the same controller this long to open the joystick calibration page.
const CALIBRATION_COMBO_TIMEOUT = 3000;

class ControllerManager {
    constructor(options = {}) {
        // Props
        this._application = options.app;
        this._serialPort = options.serialPort;
        this._parser = options.parser;
        this._windowManager = options.windowManager;
        this._calibrationManager = options.calibrationManager;
        this._window = this._windowManager.window;

        // Setup
        this._joystickSignal1 = {};
        this._joystickSignal2 = {};
        this._isRestarting = false;
        this._isInactive = false;
        this._pressedKeys = {};
        this._calibrationComboTimeouts = {};

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
        this._alternativeAnalogMessageReceivedHandler = this._alternativeAnalogMessageReceivedHandler.bind(this);
    }

    // The combination only works on the menu: a game may legitimately have
    // W and S held together, and must never be interrupted by the tool.
    _isOnMenu() {
        return this._windowManager.url === this._windowManager.originalUrl;
    }

    _trackCalibrationCombo(key, id, state) {
        if (!this._calibrationManager) return;
        if (key !== 'w' && key !== 's') return;

        const bothPressed = this._pressedKeys[`w:${id}`] && this._pressedKeys[`s:${id}`];

        if (state === 'keydown' && bothPressed && this._isOnMenu() && !this._calibrationComboTimeouts[id]) {
            this._calibrationComboTimeouts[id] = setTimeout(() => {
                delete this._calibrationComboTimeouts[id];
                // Checked again: a game may have been launched during the hold.
                if (this._isOnMenu()) this._calibrationManager.open();
            }, CALIBRATION_COMBO_TIMEOUT);
        }

        if (state === 'keyup' && this._calibrationComboTimeouts[id]) {
            clearTimeout(this._calibrationComboTimeouts[id]);
            delete this._calibrationComboTimeouts[id];
        }
    }

    _setupEventListeners() {
        this._parser.on('data', this._messageReceivedHandler);
    }

    _messageReceivedHandler(data) {
        const messageData = this._getMessageData(data);

        if (messageData.type === 'joystick') this._joystickMessageReceivedHandler(messageData);
        if (messageData.type === 'button') this._buttonMessageReceivedHandler(messageData);
        if (messageData.type === 'button-home') this._buttonHomeMessageReceivedHandler(messageData);
        if (messageData.type === 'alternative-analog') this._alternativeAnalogMessageReceivedHandler(messageData);
    }

    _joystickMessageReceivedHandler(data) {
        const id = parseInt(data.id);
        const raw = { x: parseInt(data.x), y: parseInt(data.y) };

        // Raw board values -> the legacy range every game bundle expects.
        // Pass-through until the joystick has been calibrated.
        const position = this._calibrationManager ? this._calibrationManager.map(id, raw) : raw;

        this._window.webContents.send('joystick:move', { id, position });
        // Unmapped values, used by the calibration page only.
        this._window.webContents.send('joystick:raw', { id, position: raw });

        if (id === 1) {
            const deltaX = position.x - this._joystickSignal1.x;
            const deltaY = position.y - this._joystickSignal1.y;

            if (Math.abs(deltaX) > JOYSTICK_INACTIVITY_THRESHOLD || Math.abs(deltaY) > JOYSTICK_INACTIVITY_THRESHOLD) {
                this._poke();
            }

            this._joystickSignal1 = position;
        }

        if (id === 2) {
            const deltaX = position.x - this._joystickSignal2.x;
            const deltaY = position.y - this._joystickSignal2.y;

            if (Math.abs(deltaX) > JOYSTICK_INACTIVITY_THRESHOLD || Math.abs(deltaY) > JOYSTICK_INACTIVITY_THRESHOLD) {
                this._poke();
            }

            this._joystickSignal2 = position;
        }
    }

    _buttonMessageReceivedHandler(data) {
        const id = parseInt(data.id);

        this._poke();

        if (data.state === 'keydown') this._pressedKeys[`${data.key}:${id}`] = true;
        if (data.state === 'keyup') delete this._pressedKeys[`${data.key}:${id}`];
        this._trackCalibrationCombo(data.key, id, data.state);

        this._window.webContents.send(data.state, {
            key: data.key,
            id,
        });
    }

    _buttonHomeMessageReceivedHandler(data) {
        this._poke();

        if (data.state === 'keydown') this._buttonHomeKeydownHandler(data);
        if (data.state === 'keyup') this._buttonHomeKeyupHandler(data);
    }

    _alternativeAnalogMessageReceivedHandler(data) {
        this._window.webContents.send('altenative:move', {
            id: parseInt(data.id),
            position: parseInt(data.position),
        });
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
