// Vendor
const path = require('path');
const { BrowserWindow } = require('electron');

class WindowManager {
    constructor(options = {}) {
        // Props
        this._originalUrl = options.url;
        this._width = options.width;
        this._height = options.height;
        this._preload = options.preload;
        this._ipcMain = options.ipcMain;

        // Setup
        this._url = this._originalUrl;
        this._window = this._createWindow();

        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Getters
     */
    get window() {
        return this._window;
    }

    /**
     * Public
     */
    start() {
        this._window.loadURL(this._url);
    }

    destroy() {
        this._removeEventListeners();
    }

    /**
     * Private
     */
    _createWindow() {
        const win = new BrowserWindow({
            width: this._width,
            height: this._height,
            webPreferences: {
                preload: path.join(__dirname, this._preload),
                contextIsolation: false,
                enableRemoteModule: true,
            },
            acceptFirstMouse: true,
        });

        return win;
    }

    /**
     * Bind All
     */
    _bindAll() {
        this._readyToShowHandler = this._readyToShowHandler.bind(this);
        this._loadCompleteHandler = this._loadCompleteHandler.bind(this);
        this._urlUpdateHandler = this._urlUpdateHandler.bind(this);
    }

    _setupEventListeners() {
        // Window
        this._window.once('ready-to-show', this._readyToShowHandler);
        this._window.webContents.on('did-finish-load', this._loadCompleteHandler);

        // IPC Main
        this._ipcMain.on('url:changed', this._urlUpdateHandler);
    }

    _removeEventListeners() {
        //
    }

    _readyToShowHandler() {
        this._window.show();
    }

    _loadCompleteHandler() {
        //
    }

    _urlUpdateHandler(e) {
        this._url = e.url;
        this._window.loadURL(this._url);
    }
}

module.exports = WindowManager;
