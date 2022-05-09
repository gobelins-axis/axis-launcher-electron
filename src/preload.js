const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    if (!window.__arcade__) console.error('Could not find Arcade instance');
    else window.__arcade__.set_ipc_renderer(ipcRenderer);

    const voyageGame = document.querySelector('#spacevoyage');
    const jahnerationGame = document.querySelector('#jahneration');

    const changeViewToVoyage = () => {
        ipcRenderer.send('voyageGame');
    };

    const changeViewToJah = () => {
        ipcRenderer.send('jahGame');
    };

    const backToHome = () => {
        ipcRenderer.send('backToHome');
    };

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            backToHome();
        }
    });

    if (voyageGame) {
        voyageGame.addEventListener('click', () => {
            changeViewToVoyage();
        });
    }

    if (jahnerationGame) {
        jahnerationGame.addEventListener('click', () => {
            changeViewToJah();
        });
    }
});
