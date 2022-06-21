const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    if (!window.__axis__) {
        console.error('Could not find Axis instance');
        ipcRenderer.send('exit');
    } else {
        window.__axis__.set_ipc_renderer(ipcRenderer);
    }

    document.documentElement.classList.add('is-axis-machine');
});
