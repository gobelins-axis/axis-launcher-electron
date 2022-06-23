const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    if (!window.__axis__) {
        console.error('Could not find Axis instance');
        ipcRenderer.send('exit');
    } else {
        window.__axis__.set_ipc_renderer(ipcRenderer);
    }

    ipcRenderer.on('load-complete', (event, data) => {
        window.__axis__history__index = data;
    });

    document.documentElement.classList.add('is-axis-machine');
});
