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
});
