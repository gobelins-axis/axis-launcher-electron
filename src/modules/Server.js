// Utils
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Config
require('dotenv').config();

class Server {
    constructor(options = {}) {
        this._window = options.window;

        // Configure server
        const serverPort = 9999;
        const app = express();
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use(cors({
            origin: '*',
        }));

        app.listen(serverPort, () => {
            console.log('-');
            console.log(`🏃‍♂️ Server running on port http://localhost:${serverPort}\n`);
        });

        app.post('/buildup', (req, res) => {
            console.log('buildup');
            this._window.webContents.send('buildup', {});
            res.sendStatus(200);
        });

        app.post('/reveal', (req, res) => {
            console.log('reveal');
            this._window.webContents.send('reveal', {});
            res.sendStatus(200);
        });
    }
}

module.exports = Server;
