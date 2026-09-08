// Vendor
const { ipcMain } = require('electron');

// Commands understood by the board (see arduino/scripts/V6-LED/SerialCommands.h).
const COMMAND_CLEAR = 'type:led__cmd:clear\n';

/**
 * LED pass-through between the page and the board.
 *
 * Games drive the LEDs through axis-api, which sends one `led:set` IPC per
 * pixel with a pre-formatted line (`strip;index;r,g,b\n`). That line format is
 * embedded in every shipped game and is forwarded untouched; the board
 * coalesces the lines into frames.
 *
 * The launcher only adds hygiene: the strips are cleared whenever the window
 * navigates (a game can never leave its colours behind) and whenever the board
 * announces it has (re)booted.
 */
class LedManager {
    constructor(options = {}) {
        // Props
        this._serialPort = options.serialPort;
        this._parser = options.parser;
        this._window = options.windowManager.window;

        // Setup
        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Public
     */
    clear() {
        this._write(COMMAND_CLEAR);
    }

    /**
     * Private
     */
    _bindAll() {
        this._messageReceivedHandler = this._messageReceivedHandler.bind(this);
        this._setColorHandler = this._setColorHandler.bind(this);
        this._clearHandler = this._clearHandler.bind(this);
        this._navigationHandler = this._navigationHandler.bind(this);
        this._serialPortWriteHandler = this._serialPortWriteHandler.bind(this);
    }

    _setupEventListeners() {
        this._parser.on('data', this._messageReceivedHandler);
        ipcMain.on('led:set', this._setColorHandler);
        ipcMain.on('led:clear', this._clearHandler);
        this._window.webContents.on('did-start-loading', this._navigationHandler);
    }

    _write(data) {
        if (typeof data !== 'string' || data.length === 0) return;
        this._serialPort.write(data, this._serialPortWriteHandler);
    }

    /**
     * Handlers
     */
    _messageReceivedHandler(data) {
        // The board starts dark; clearing on "ready" also resets anything the
        // launcher believed was lit if the board was replugged mid-session.
        if (typeof data === 'string' && data.startsWith('type:ready')) this.clear();
    }

    _setColorHandler(event, payload = {}) {
        this._write(payload.data);
    }

    _clearHandler() {
        this.clear();
    }

    _navigationHandler() {
        // Any page change: menu, game start, game exit, sleep.
        this.clear();
    }

    _serialPortWriteHandler(error) {
        if (error) console.error('LED write failed', error);
    }
}

module.exports = LedManager;
