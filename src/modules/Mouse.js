// Vendor
const { ipcMain } = require('electron');
const robot = require('robotjs');

// Utils
const clamp = require('../utils/clamp');

const SCREEN_SIZE = robot.getScreenSize();
const SCREEN_WIDTH = SCREEN_SIZE.width;
const SCREEN_HEIGHT = SCREEN_SIZE.height;

const SPEED = 12;

class Mouse {
    constructor(options = {}) {
        // Setup
        this._speed = 12;
        this._isEnabled = false;

        this._bindAll();
        this._setupEventListeners();

        this._deadPosition = { x: 0, y: SCREEN_HEIGHT / 2 };
        this._position = robot.getMousePos();
    }

    /**
     * Private
     */
    _bindAll() {
        this._mousemoveHandler = this._mousemoveHandler.bind(this);
        this._mouseClickHandler = this._mouseClickHandler.bind(this);
        this._mouseEnableHandler = this._mouseEnableHandler.bind(this);
        this._mouseDisableHandler = this._mouseDisableHandler.bind(this);
    }

    _setupEventListeners() {
        ipcMain.on('mouse:move', this._mousemoveHandler);
        ipcMain.on('mouse:click', this._mouseClickHandler);
        ipcMain.on('mouse:enable', this._mouseEnableHandler);
        ipcMain.on('mouse:disable', this._mouseDisableHandler);
    }

    _mousemoveHandler(event, position) {
        if (!this._isEnabled) return;
        this._position.x += position.x * this._speed;
        this._position.x = clamp(this._position.x, 0, SCREEN_WIDTH);
        this._position.y -= position.y * this._speed;
        this._position.y = clamp(this._position.y, 0, SCREEN_HEIGHT);
        robot.moveMouse(this._position.x, this._position.y);
    }

    _mouseClickHandler(event, data) {
        if (!this._isEnabled) return;
        robot.mouseClick();
    }

    _mouseEnableHandler(event, speedFactor = 1) {
        this._speed = speedFactor * SPEED;
        this._isEnabled = true;
    }

    _mouseDisableHandler() {
        this._position = robot.getMousePos();
        this._isEnabled = false;
        robot.moveMouse(this._deadPosition.x, this._deadPosition.y);
    }
}

module.exports = Mouse;
