// Vendor
const { ipcMain } = require('electron');
const cron = require('node-cron');
const admin = require('firebase-admin');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Firebase service account
const serviceAccount = require('../../firebase-service-account.json');

const REFRESH_TOKEN_RATE = 1; // Minutes

class FirebaseAuthentificator {
    constructor() {
        // Setup
        this._token = null;

        this._config = {
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://gobelins-axis-default-rtdb.europe-west1.firebasedatabase.app',
        };

        this._auth = this._setupAuth();

        this._bindAll();
    }

    /**
     * Getters
     */
    get token() {
        return this._token;
    }

    /**
     * Public
     */
    start() {
        this._createCustomToken().then(this._tokenCreatedHandler);

        cron.schedule(`*/${REFRESH_TOKEN_RATE} * * * *`, () => {
            this._createCustomToken().then(this._tokenCreatedHandler);
        });
    }

    /**
     * Private
     */
    _setupAuth() {
        const apps = getApps();
        const firebaseApp = !apps.length ? initializeApp(this._config) : apps[0];
        const auth = getAuth(firebaseApp);
        return auth;
    }

    _createCustomToken() {
        const uid = 'axis-machine';
        return this._auth.createCustomToken(uid, { superuser: true });
    }

    _bindAll() {
        this._tokenCreatedHandler = this._tokenCreatedHandler.bind(this);
    }

    _tokenCreatedHandler(token) {
        this._token = token;
    }
}

module.exports = FirebaseAuthentificator;
