// Vendor
const { ipcMain } = require('electron');

// Modules
const FirebaseApplication = require('./FirebaseApplication');
const FirebaseAuthentificator = require('./FirebaseAuthentificator');

class LeaderboardProxy {
    constructor() {
        // Setup
        this._firebaseApplication = this._createFirebaseApplication();
        this._firebaseAuthentificator = this._createFirebaseAuthentificator();

        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Public
     */
    start() {
        this._firebaseAuthentificator.start();
    }

    /**
     * Private
     */
    _createFirebaseApplication() {
        const firebaseApplication = new FirebaseApplication();
        return firebaseApplication;
    }

    _createFirebaseAuthentificator() {
        const authentificator = new FirebaseAuthentificator();
        return authentificator;
    }

    _bindAll() {
        this._getRequestHandler = this._getRequestHandler.bind(this);
        this._postRequestHandler = this._postRequestHandler.bind(this);
    }

    _setupEventListeners() {
        ipcMain.on('leaderboard:get', this._getRequestHandler);
        ipcMain.on('leaderboard:post', this._postRequestHandler);
    }

    _getRequestHandler(event, data) {
        const id = data.id;

        this._firebaseApplication.getScores(id)
            .then(
                (scores) => {
                    event.sender.send('leaderboard:get:completed', scores);
                },
                (error) => {
                    event.sender.send('leaderboard:get:error', error);
                }
            );
    }

    _postRequestHandler(event, data) {
        const id = data.id;
        const score = data.score;
        const token = this._firebaseAuthentificator.token;

        this._firebaseApplication.postScore(token, id, score)
            .then(
                () => {
                    event.sender.send('leaderboard:post:completed', { message: 'Success' });
                },
                (error) => {
                    event.sender.send('leaderboard:post:error', error);
                }
            );
    }
}

module.exports = LeaderboardProxy;
