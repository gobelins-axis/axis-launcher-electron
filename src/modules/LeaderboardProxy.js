// Vendor
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Modules
const FirebaseApplication = require('./FirebaseApplication');
const FirebaseAuthentificator = require('./FirebaseAuthentificator');

class LeaderboardProxy {
    constructor(options = {}) {
        // Props
        this._port = options.port;

        // Setup
        this._firebaseApplication = this._createFirebaseApplication();
        this._firebaseAuthentificator = this._createFirebaseAuthentificator();
        this._expressApplication = this._createExpressApplication();

        this._bindAll();
        this._setupEventListeners();
    }

    /**
     * Public
     */
    start() {
        this._firebaseAuthentificator.start();
        this._expressApplication.listen(this._port, () => {
            console.log(`\n🏃 Server running on http://localhost:${this._port}\n`);
        });
    }

    /**
     * Private
     */
    _createExpressApplication() {
        const app = express();
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use(cors({ origin: '*' }));
        return app;
    }

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
        this._expressApplication.get('/get/:id', this._getRequestHandler);
        this._expressApplication.post('/post/:id', this._postRequestHandler);
    }

    _getRequestHandler(request, response) {
        const id = request.params.id;
        response.status(200).send({ message: `Coucou ${id}` });
    }

    _postRequestHandler(request, response) {
        const id = request.params.id;
        const score = request.body;
        const token = this._firebaseAuthentificator.token;

        this._firebaseApplication.postScore(token, id, score)
            .then(
                () => {
                    response.status(200).send({ message: 'Success' });
                },
                (error) => {
                    response.status(500).send({ ...error });
                }
            );
    }
}

module.exports = LeaderboardProxy;
