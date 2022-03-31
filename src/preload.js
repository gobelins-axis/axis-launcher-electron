const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log(window);
        if (!window.__arcade__) {
            console.error('Could not find Arcade instance');
        } else {
            window.__arcade__.set_ipc_renderer(ipcRenderer);
        }
    }, 1000);

    const voyageGame = document.querySelector('.spacevoyage');
    const jahnerationGame = document.querySelector('.jahneration');

    const changeViewToVoyage = () => {
        ipcRenderer.sendSync('voyageGame');
    }

    const changeViewToJah = () => {
        ipcRenderer.sendSync('jahGame');
    }

    const backToHome = () => {
        ipcRenderer.sendSync('backToHome');
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            backToHome()
        }
    })

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
