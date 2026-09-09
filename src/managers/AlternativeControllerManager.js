// Vendor
const { ipcMain } = require('electron');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Utils
const parseMessage = require('../utils/parseMessage');

// Alternative boards talk at the de-facto default of Uno / Nano / ESP32
// sketches. Teensy ignores the baud rate on USB serial.
const BAUD_RATE = 115200;
// Opening the port resets most Arduino boards (DTR); an Uno needs about two
// seconds to boot before it can announce itself.
const HANDSHAKE_TIMEOUT = 3000;
// Sent right after opening, for boards that do not reset on open (Teensy).
const PING = 'type:ping\r\n';
// Slots 1 and 2 are the cabinet's own controllers.
const FIRST_SLOT = 3;

const STATE_HANDSHAKING = 'handshaking';
const STATE_CONNECTED = 'connected';
const STATE_REJECTED = 'rejected';
const STATE_CLOSED = 'closed';

/**
 * Alternative controllers: any USB serial board plugged into the machine
 * while it runs (Uno, Nano, ESP32, Teensy...).
 *
 * A board is not identified by its USB ids but by a handshake. When the
 * watcher reports a new port, it is opened and pinged; the board has
 * HANDSHAKE_TIMEOUT to answer `type:ready__controller:<name>__version:<n>`.
 * Boards that stay silent are closed and ignored until unplugged, so the
 * launcher never keeps hold of a device plugged in for another reason (an
 * Arduino IDE upload keeps working).
 *
 * Accepted boards get a slot (3, 4, ...) and send `type:alternative__...`
 * lines. The line is parsed like every other message and forwarded to the
 * page as is, so a game and its controller agree on the fields between them.
 *
 * IPC (main -> renderer):
 *   alternative:connected     { slot, name, version, path }
 *   alternative:disconnected  { slot, name, path }
 *   alternative:message       { slot, name, data }   data = fields minus `type`
 *   alternative:raw           { path, line }         every line, for the debug page
 * IPC (renderer -> main):
 *   alternative:list          invoke -> [{ path, state, slot, name, version, ...usb ids }]
 */
class AlternativeControllerManager {
    constructor(options = {}) {
        // Props
        this._watcher = options.usbWatcher;
        this._windowManager = options.windowManager;
        // Null when the launcher runs without the main board (dev machine).
        this._controllerManager = options.controllerManager || null;
        this._window = this._windowManager.window;

        // Setup
        this._entries = new Map(); // path -> entry
        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Public
     */
    get controllers() {
        return Array.from(this._entries.values()).map(describe);
    }

    /**
     * Private
     */
    _bindAll() {
        this._addedHandler = this._addedHandler.bind(this);
        this._removedHandler = this._removedHandler.bind(this);
        this._listHandler = this._listHandler.bind(this);
    }

    _setupEventListeners() {
        this._watcher.on('added', this._addedHandler);
        this._watcher.on('removed', this._removedHandler);
        ipcMain.handle('alternative:list', this._listHandler);
    }

    _send(channel, payload) {
        if (this._window.isDestroyed()) return;
        this._window.webContents.send(channel, payload);
    }

    _freeSlot() {
        const used = new Set(Array.from(this._entries.values()).map((entry) => entry.slot));
        let slot = FIRST_SLOT;
        while (used.has(slot)) slot++;
        return slot;
    }

    _open(descriptor) {
        const entry = {
            descriptor,
            path: descriptor.path,
            state: STATE_HANDSHAKING,
            slot: null,
            name: null,
            version: null,
            port: null,
            parser: null,
            timeout: null,
        };
        this._entries.set(entry.path, entry);

        console.log(`🔌 Alternative controller candidate on ${entry.path}, waiting for ready...`);

        const port = new SerialPort({ path: entry.path, baudRate: BAUD_RATE, autoOpen: false });
        const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        entry.port = port;
        entry.parser = parser;

        parser.on('data', (line) => this._lineHandler(entry, line));
        port.on('close', () => this._closeHandler(entry));
        port.on('error', (error) => this._errorHandler(entry, error));

        port.open((error) => {
            if (error) return this._errorHandler(entry, error);
            port.write(PING);
            entry.timeout = setTimeout(() => this._handshakeTimeoutHandler(entry), HANDSHAKE_TIMEOUT);
        });
    }

    _accept(entry, data) {
        clearTimeout(entry.timeout);
        entry.timeout = null;
        entry.state = STATE_CONNECTED;
        entry.slot = this._freeSlot();
        entry.name = data.controller || entry.descriptor.manufacturer || 'unknown';
        entry.version = data.version || null;

        console.log(`✅ Alternative controller "${entry.name}" connected on ${entry.path} as slot ${entry.slot}`);
        this._send('alternative:connected', describe(entry));
    }

    _reject(entry, reason) {
        clearTimeout(entry.timeout);
        entry.timeout = null;
        entry.state = STATE_REJECTED;
        console.log(`⏭ ${entry.path} ignored: ${reason}`);
        // Kept in the map, marked rejected, so it is not reopened until unplugged.
        this._closePort(entry);
    }

    _closePort(entry) {
        const port = entry.port;
        if (!port) return;
        entry.port = null;
        if (port.isOpen) port.close();
    }

    _teardown(entry) {
        // Re-entrant: closing the port fires `close`, which lands here again.
        if (this._entries.get(entry.path) !== entry) return;
        this._entries.delete(entry.path);

        clearTimeout(entry.timeout);
        entry.timeout = null;
        const wasConnected = entry.state === STATE_CONNECTED;
        entry.state = STATE_CLOSED;
        this._closePort(entry);

        if (wasConnected) {
            console.log(`🔌 Alternative controller "${entry.name}" (slot ${entry.slot}) disconnected`);
            this._send('alternative:disconnected', describe(entry));
        }
    }

    /**
     * Handlers
     */
    _addedHandler(descriptor) {
        if (this._entries.has(descriptor.path)) return;
        this._open(descriptor);
    }

    _removedHandler(descriptor) {
        const entry = this._entries.get(descriptor.path);
        if (entry) this._teardown(entry);
    }

    _lineHandler(entry, line) {
        this._send('alternative:raw', { path: entry.path, line });

        const data = parseMessage(line);

        if (entry.state === STATE_HANDSHAKING) {
            if (data.type === 'ready') this._accept(entry, data);
            return;
        }

        if (entry.state !== STATE_CONNECTED) return;
        if (data.type !== 'alternative') return;

        // Input on any controller keeps the machine awake.
        if (this._controllerManager) this._controllerManager.poke();

        const { type, ...payload } = data;
        this._send('alternative:message', { slot: entry.slot, name: entry.name, data: payload });
    }

    _handshakeTimeoutHandler(entry) {
        if (entry.state !== STATE_HANDSHAKING) return;
        this._reject(entry, 'no ready message');
    }

    _closeHandler(entry) {
        // Fires on our own close and when the cable is pulled (`disconnected`).
        // A rejected entry stays listed so the path is not retried.
        if (entry.state === STATE_REJECTED) {
            entry.port = null;
            return;
        }
        this._teardown(entry);
    }

    _errorHandler(entry, error) {
        console.error(`Alternative controller error on ${entry.path}`, error.message);
        if (entry.state === STATE_HANDSHAKING) return this._reject(entry, error.message);
        this._teardown(entry);
    }

    _listHandler() {
        return this.controllers;
    }
}

function describe(entry) {
    const { vendorId, productId, serialNumber, manufacturer } = entry.descriptor;
    return {
        path: entry.path,
        state: entry.state,
        slot: entry.slot,
        name: entry.name,
        version: entry.version,
        vendorId,
        productId,
        serialNumber,
        manufacturer,
    };
}

module.exports = AlternativeControllerManager;
