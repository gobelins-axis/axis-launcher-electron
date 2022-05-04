const { ipcRenderer } = require('electron');
const { webContents } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    console.log('preload')
    setTimeout(() => {
        console.log(window);
        if (!window.__arcade__) {
            console.error('Could not find Arcade instance');
        } else {
            window.__arcade__.set_ipc_renderer(ipcRenderer);
        }
    }, 1000);

    ipcRenderer.on("hide", function () {
        console.log('hide pls')
        const loadingOverlay = document.querySelector('#loadingOverlay')
        loadingOverlay.classList.remove('hidden');
    });

    const voyageGame = document.querySelector('#spacevoyage');
    const jahnerationGame = document.querySelector('#jahneration');

    const changeViewToVoyage = () => {
        ipcRenderer.send('voyageGame');
    }

    const changeViewToJah = () => {
        ipcRenderer.send('jahGame');
    }

    const backToHome = () => {
        ipcRenderer.send('backToHome');
    }

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
