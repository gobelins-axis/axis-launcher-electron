// Utils
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Config
require('dotenv').config();

class Server {
    constructor(options = {}) {
        // Props
        this._serialPort = options.serialPort;
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
            console.log(`\n 🏃‍♂️ Server running on port http://localhost:${serverPort}\n`);
        });

        app.post('/buildup1', (req, res) => {
            this.sendAction('buildup1');
            res.sendStatus(200);
        });

        app.post('/buildup2', (req, res) => {
            this.sendAction('buildup2');
            res.sendStatus(200);
        });

        app.post('/reveal', (req, res) => {
            this.sendAction('reveal');
            res.sendStatus(200);
        });

        app.post('/start', (req, res) => {
            this.sendAction('start');
            res.sendStatus(200);
        });
    }

    onComplete(err) {
        if (err) console.log('Something went wrong...');
    }

    sendAction(action) {
        console.log(`Sending action : ${action}`);
        this._window.webContents.send('message', action);
        this._serialPort.write(`${action}\n`, this.onComplete);
    }
}

module.exports = Server;
