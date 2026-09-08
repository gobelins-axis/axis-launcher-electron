// Vendor
const path = require('path');
const { pathToFileURL } = require('url');
const { app, ipcMain } = require('electron');

// Modules
const JoystickCalibration = require('../modules/JoystickCalibration');

const CALIBRATION_PAGE = path.join(__dirname, '../calibration/index.html');
const CALIBRATION_FILE = 'joystick-calibration.json';

/**
 * Joystick calibration, launcher side.
 *
 * The calibration page (src/calibration) is loaded in the main window like
 * a game. This manager owns the stored calibration, applies it to every
 * joystick message (see ControllerManager) and answers the page over IPC:
 *
 *   renderer -> main
 *     calibration:open                       load the calibration page
 *     calibration:get       (invoke)         { calibrations, legacyRange }
 *     calibration:apply     { id, calibration }  preview a draft through the real pipeline
 *     calibration:save      { id }           write the draft to disk
 *     calibration:discard   { id }           drop the draft
 *
 *   main -> renderer
 *     joystick:raw          { id, position } unmapped board values, sent
 *                                            alongside every joystick:move
 */
class CalibrationManager {
    constructor(options = {}) {
        // Props
        this._windowManager = options.windowManager;
        this._window = this._windowManager.window;

        // Setup
        this._url = pathToFileURL(CALIBRATION_PAGE).href;
        this._store = new JoystickCalibration({
            filePath: path.join(app.getPath('userData'), CALIBRATION_FILE),
        });

        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Getters
     */
    get url() {
        return this._url;
    }

    get store() {
        return this._store;
    }

    get isOpen() {
        return this._isCalibrationUrl(this._window.webContents.getURL());
    }

    /**
     * Public
     */
    open() {
        if (this.isOpen) return;
        console.log('🕹  Opening joystick calibration');
        this._windowManager.openUrl(this._url);
    }

    map(id, raw) {
        return this._store.map(id, raw);
    }

    /**
     * Private
     */
    _bindAll() {
        this._openHandler = this._openHandler.bind(this);
        this._getHandler = this._getHandler.bind(this);
        this._applyHandler = this._applyHandler.bind(this);
        this._saveHandler = this._saveHandler.bind(this);
        this._discardHandler = this._discardHandler.bind(this);
        this._loadCompleteHandler = this._loadCompleteHandler.bind(this);
    }

    _setupEventListeners() {
        ipcMain.on('calibration:open', this._openHandler);
        ipcMain.handle('calibration:get', this._getHandler);
        ipcMain.on('calibration:apply', this._applyHandler);
        ipcMain.on('calibration:save', this._saveHandler);
        ipcMain.on('calibration:discard', this._discardHandler);

        this._window.webContents.on('did-finish-load', this._loadCompleteHandler);
    }

    _isCalibrationUrl(url) {
        return typeof url === 'string' && url.split('?')[0] === this._url;
    }

    /**
     * Handlers
     */
    _openHandler() {
        this.open();
    }

    _getHandler() {
        return {
            calibrations: this._store.getAll(),
            legacyRange: JoystickCalibration.LEGACY_RANGE,
        };
    }

    _applyHandler(event, data = {}) {
        if (!data.id || !data.calibration) return;
        this._store.setDraft(data.id, data.calibration);
    }

    _saveHandler(event, data = {}) {
        const saved = this._store.commitDraft(data.id);
        console.log(`🕹  Joystick ${data.id} calibration ${saved ? 'saved' : 'not saved (no draft)'}`);
    }

    _discardHandler(event, data = {}) {
        this._store.discardDraft(data.id);
    }

    _loadCompleteHandler() {
        // Leaving the calibration page for any reason (exit, sleep, menu)
        // drops previews that were never saved.
        if (!this.isOpen) this._store.discardAllDrafts();
    }
}

module.exports = CalibrationManager;
