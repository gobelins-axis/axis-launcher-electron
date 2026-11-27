// Vendor
const path = require('path');
const { app, ipcMain } = require('electron');

// Modules
const JoystickCalibration = require('../modules/JoystickCalibration');

const CALIBRATION_FILE = 'joystick-calibration.json';

/**
 * Joystick calibration, launcher side.
 *
 * The calibration page lives in axis-tools (gobelins-axis/axis-tools) and is
 * loaded in the main window like a game. This manager owns the stored
 * calibration, applies it to every joystick message (see ControllerManager)
 * and answers the page over IPC:
 *
 *   renderer -> main
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
        this._store = new JoystickCalibration({
            filePath: path.join(app.getPath('userData'), CALIBRATION_FILE),
        });

        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Getters
     */
    get store() {
        return this._store;
    }

    /**
     * Public
     */
    map(id, raw) {
        return this._store.map(id, raw);
    }

    /**
     * Private
     */
    _bindAll() {
        this._getHandler = this._getHandler.bind(this);
        this._applyHandler = this._applyHandler.bind(this);
        this._saveHandler = this._saveHandler.bind(this);
        this._discardHandler = this._discardHandler.bind(this);
        this._startLoadingHandler = this._startLoadingHandler.bind(this);
    }

    _setupEventListeners() {
        ipcMain.handle('calibration:get', this._getHandler);
        ipcMain.on('calibration:apply', this._applyHandler);
        ipcMain.on('calibration:save', this._saveHandler);
        ipcMain.on('calibration:discard', this._discardHandler);

        this._window.webContents.on('did-start-loading', this._startLoadingHandler);
    }

    /**
     * Handlers
     */
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

    _startLoadingHandler() {
        // Any page load (back to the tool picker, exit, sleep, menu) drops
        // previews that were never saved. Drafts only exist while the
        // calibration page is in its test step, so nothing else is affected.
        this._store.discardAllDrafts();
    }
}

module.exports = CalibrationManager;
