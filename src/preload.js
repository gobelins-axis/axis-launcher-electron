const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    if (!window.__axis__) console.error('Could not find Axis instance');
    else window.__axis__.set_ipc_renderer(ipcRenderer);
});
