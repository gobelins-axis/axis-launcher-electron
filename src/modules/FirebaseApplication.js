// Vendor
const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, doc, collection, getDocs, addDoc } = require('firebase/firestore');
const { getAuth, signInWithCustomToken } = require('firebase/auth');

class FirebaseApplication {
    constructor() {
        // Setup
        this._config = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: 'gobelins-axis.firebaseapp.com',
            projectId: 'gobelins-axis',
            storageBucket: 'gobelins-axis.appspot.com',
            messagingSenderId: '529378279324',
            appId: '1:529378279324:web:3f38515eec42d202dc9259',
            measurementId: 'G-YSGEBD6L4W',
        };

        const apps = getApps();
        this._firebase = !apps.length ? initializeApp(this._config) : apps[0];
        this._auth = getAuth(this._firebase);
        this._firestore = getFirestore(this._firebase);
    }

    /**
     * Getters
     */
    get firebase() {
        return this._firebase;
    }

    get auth() {
        return this._auth;
    }

    get firestore() {
        return this._firestore;
    }

    /**
     * Public
     */
    postScore(token, id, score) {
        const promise = new Promise((resolve, reject) => {
            signInWithCustomToken(this._auth, token)
                .then((credentials) => {
                    const leaderboardCollection = collection(this._firestore, 'leaderboards');
                    const gameDocument = doc(leaderboardCollection, id);
                    const scoreCollection = collection(gameDocument, 'scores');
                    addDoc(scoreCollection, score).then((response) => {
                        resolve(response);
                    }).catch((error) => {
                        resolve(error);
                    });
                })
                .catch((error) => {
                    reject(error);
                });
        });
        return promise;
    }

    getScores(id) {
        const promise = new Promise((resolve, reject) => {
            const leaderboardCollectionRef = collection(this._firestore, 'leaderboards');
            const gameDocumentRef = doc(leaderboardCollectionRef, id);
            const scoreCollection = collection(gameDocumentRef, 'scores');
            getDocs(scoreCollection)
                .then((response) => {
                    const scores = response.docs.map(item => item.data());
                    resolve(scores);
                })
                .catch((error) => {
                    console.log(error);
                    reject(error);
                });
        });
        return promise;
    }
}

module.exports = FirebaseApplication;
