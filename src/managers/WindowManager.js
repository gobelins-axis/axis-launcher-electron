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

    get originalUrl() {
        return this._originalUrl;
    }

    get url() {
        return this._url;
    }

    /**
     * Public
     */
    start() {
        return this._window.loadURL(this._url);
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
        this._exitGameHandler = this._exitGameHandler.bind(this);
    }

    _setupEventListeners() {
        // Window
        this._window.once('ready-to-show', this._readyToShowHandler);
        this._window.webContents.on('did-finish-load', this._loadCompleteHandler);

        // IPC Main
        this._ipcMain.on('url:changed', this._urlUpdateHandler);
        this._ipcMain.on('exit', this._exitGameHandler);
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

    _urlUpdateHandler(event, data) {
        if (data.url === this._url) return;
        this._url = data.url;
        this._window.loadURL(this._url);
    }

    _exitGameHandler() {
        if (this._url === this._originalUrl) return;
        this._url = this._originalUrl;
        this._window.loadURL(this._url);
    }
}

module.exports = WindowManager;
