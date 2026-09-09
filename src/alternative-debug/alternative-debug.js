/* eslint-env browser */
/* global require */

// Alternative controllers debug page.
//
// Shows every USB serial board the launcher sees, its handshake state, and
// the messages accepted boards send, exactly as the page receives them over
// IPC (see managers/AlternativeControllerManager.js). Loaded like a game by
// the launcher when OPEN_ALTERNATIVE_DEBUG_ON_START is set in src/main.js.
//
// axis-api is loaded so the standard Home / exit flow works and the preload
// finds window.__axis__ like on any page.

const { ipcRenderer } = require('electron');
require('axis-api');

const MAX_LOG_LINES = 40;

const els = {
    devices: document.querySelector('.js-devices'),
    empty: document.querySelector('.js-empty'),
    log: document.querySelector('.js-log'),
    count: document.querySelector('.js-count'),
};

const state = {
    devices: new Map(), // path -> device description
    lastMessage: new Map(), // path -> data
    count: 0,
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
    els.devices.querySelectorAll('.device').forEach((el) => el.remove());
    els.empty.hidden = state.devices.size > 0;

    state.devices.forEach((device) => {
        const el = document.createElement('div');
        el.className = `device is-${device.state}`;

        const ids = [device.manufacturer, device.vendorId && `${device.vendorId}:${device.productId}`, device.serialNumber && `sn ${device.serialNumber}`]
            .filter(Boolean)
            .join(' · ');

        const last = state.lastMessage.get(device.path);
        const lastRows = last
            ? Object.keys(last).map((key) => `<dt>${escape(key)}</dt><dd>${escape(last[key])}</dd>`).join('')
            : '';

        el.innerHTML = `
            <div class="device-slot">${device.slot || '·'}</div>
            <div>
                <div class="device-name">${escape(device.name || device.path)}<span class="device-state">${device.state}</span></div>
                <div class="device-meta">${escape(device.path)}${ids ? ' · ' + escape(ids) : ''}${device.version ? ' · v' + escape(device.version) : ''}</div>
                ${lastRows ? `<dl class="device-last">${lastRows}</dl>` : ''}
            </div>
        `;
        els.devices.appendChild(el);
    });

    els.count.textContent = state.count;
}

function log(path, line) {
    const el = document.createElement('div');
    el.className = 'log-line';
    el.innerHTML = `<span class="path">${escape(shortPath(path))}</span>${escape(line)}`;
    els.log.appendChild(el);
    while (els.log.childElementCount > MAX_LOG_LINES) els.log.firstElementChild.remove();
}

function shortPath(path) {
    return path.replace('/dev/cu.', '');
}

function escape(value) {
    return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

async function refresh() {
    const list = await ipcRenderer.invoke('alternative:list');
    state.devices = new Map(list.map((device) => [device.path, device]));
    render();
}

ipcRenderer.on('alternative:connected', refresh);
ipcRenderer.on('alternative:disconnected', (event, device) => {
    state.lastMessage.delete(device.path);
    refresh();
});

ipcRenderer.on('alternative:raw', (event, { path, line }) => {
    log(path, line);
    // Candidates and rejections are not announced on their own: any line from
    // a path we do not know yet means the list changed.
    if (!state.devices.has(path)) refresh();
});

ipcRenderer.on('alternative:message', (event, { slot, name, data }) => {
    state.count++;
    const device = Array.from(state.devices.values()).find((item) => item.slot === slot);
    if (device) state.lastMessage.set(device.path, data);
    render();
});

refresh();
// Rejected boards are silent by definition: poll so their state shows up.
setInterval(refresh, 2000);
