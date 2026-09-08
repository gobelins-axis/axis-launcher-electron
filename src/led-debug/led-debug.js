/* eslint-env browser */
/* global require */

// LED debug page.
//
// Drives the machine's LEDs exclusively through axis-api, exactly like a game
// would, so it exercises the whole chain: axis-api -> led:set IPC -> LedManager
// -> serial -> V6-LED firmware. Loaded like a game by the launcher when
// OPEN_LED_DEBUG_ON_START is set in src/main.js.
//
// Behaviours:
//   - Button echo: every controller button lights its own LED while held.
//   - Strip sweep: while W of controller 1 is held, the left and right strips
//     light up one LED at a time; at the end the sweep restarts from the top
//     with the next colour: red, green, blue, red...

const { ipcRenderer } = require('electron');
const Axis = require('axis-api').default;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ECHO_COLOR = 'white';
const OFF_COLOR = 'black';

const SWEEP_BUTTON = { key: 'w', id: 1 };
const SWEEP_COLORS = [
    { name: 'red', css: 'rgb(255, 0, 0)' },
    { name: 'green', css: 'rgb(0, 255, 0)' },
    { name: 'blue', css: 'rgb(0, 0, 255)' },
];
// One LED every 40 ms: a 51-LED strip takes about two seconds per pass.
const SWEEP_STEP_MS = 40;

const CONTROLLER_KEYS = ['a', 'x', 'i', 's', 'w'];
const CONTROLLER_IDS = [1, 2];

// Keyboard emulation for development on a laptop (same mapping as the README).
Axis.registerKeys('q', 'a', 1);
Axis.registerKeys('d', 'x', 1);
Axis.registerKeys('z', 'i', 1);
Axis.registerKeys('s', 's', 1);
Axis.registerKeys(' ', 'w', 1);
Axis.registerKeys('ArrowLeft', 'a', 2);
Axis.registerKeys('ArrowRight', 'x', 2);
Axis.registerKeys('ArrowUp', 'i', 2);
Axis.registerKeys('ArrowDown', 's', 2);
Axis.registerKeys('Enter', 'w', 2);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const strips = {
    left: Axis.ledManager.getLedGroupByName('left-strip'),
    right: Axis.ledManager.getLedGroupByName('right-strip'),
};

const stripLength = Math.min(strips.left.leds.length, strips.right.leds.length);

const state = {
    held: {}, // "key:id" -> true while pressed
    sweep: {
        running: false,
        index: 0, // next LED to light
        colorIndex: 0,
        passes: 0,
        cells: new Array(stripLength).fill(null), // colour name per LED, mirrors the strips
    },
    sent: 0, // LED commands issued, for the footer counter
};

let sweepTimer = null;

const els = {
    buttons: {},
    cells: { left: [], right: [] },
    sweepStatus: document.querySelector('.js-sweep-status'),
    sweepColor: document.querySelector('.js-sweep-color'),
    sweepIndex: document.querySelector('.js-sweep-index'),
    sweepPasses: document.querySelector('.js-sweep-passes'),
    sent: document.querySelector('.js-sent'),
};

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

function buildButtons() {
    CONTROLLER_IDS.forEach((id) => {
        const row = document.querySelector(`.js-controller-${id}`);
        CONTROLLER_KEYS.forEach((key) => {
            const badge = document.createElement('div');
            badge.className = 'badge';
            badge.dataset.button = `${key}:${id}`;

            if (key === 'w') {
                const letter = document.createElement('span');
                letter.className = 'badge-letter';
                letter.textContent = 'W';
                badge.appendChild(letter);
            } else {
                const icon = document.createElement('img');
                icon.className = 'badge-icon';
                icon.src = `../calibration/icons/input-${key}.svg`;
                icon.alt = key.toUpperCase();
                badge.appendChild(icon);
            }

            row.appendChild(badge);
            els.buttons[`${key}:${id}`] = badge;
        });
    });
}

function buildStrips() {
    ['left', 'right'].forEach((side) => {
        const bar = document.querySelector(`.js-strip-${side}`);
        for (let i = 0; i < stripLength; i++) {
            const cell = document.createElement('span');
            cell.className = 'cell';
            bar.appendChild(cell);
            els.cells[side].push(cell);
        }
    });
}

function render() {
    Object.keys(els.buttons).forEach((id) => {
        els.buttons[id].classList.toggle('is-held', Boolean(state.held[id]));
    });

    const { sweep } = state;
    for (let i = 0; i < stripLength; i++) {
        const color = sweep.cells[i];
        ['left', 'right'].forEach((side) => {
            const cell = els.cells[side][i];
            cell.style.background = color ? SWEEP_COLORS.find((c) => c.name === color).css : '';
            cell.classList.toggle('is-next', sweep.running && i === sweep.index);
        });
    }

    els.sweepStatus.textContent = sweep.running ? 'Sweeping' : 'Paused, hold W on controller 1';
    els.sweepColor.textContent = SWEEP_COLORS[sweep.colorIndex].name;
    els.sweepIndex.textContent = `${sweep.index} / ${stripLength}`;
    els.sweepPasses.textContent = String(sweep.passes);
    els.sent.textContent = String(state.sent);
}

// ---------------------------------------------------------------------------
// LED control (axis-api only)
// ---------------------------------------------------------------------------

function setButtonLed(key, id, color) {
    const button = Axis.buttonManager.getButton(key, id);
    if (!button) return;
    button.setLedColor(color);
    state.sent++;
}

function setStripLed(index, color) {
    strips.left.leds[index].setColor(color);
    strips.right.leds[index].setColor(color);
    state.sent += 2;
}

function sweepStep() {
    const { sweep } = state;
    const color = SWEEP_COLORS[sweep.colorIndex];

    setStripLed(sweep.index, color.css);
    sweep.cells[sweep.index] = color.name;
    sweep.index++;

    if (sweep.index >= stripLength) {
        // End of the strip: restart from the top with the next colour,
        // overwriting the previous pass LED by LED.
        sweep.index = 0;
        sweep.colorIndex = (sweep.colorIndex + 1) % SWEEP_COLORS.length;
        sweep.passes++;
    }

    render();
}

function startSweep() {
    if (state.sweep.running) return;
    state.sweep.running = true;
    sweepStep();
    sweepTimer = setInterval(sweepStep, SWEEP_STEP_MS);
    render();
}

function pauseSweep() {
    if (!state.sweep.running) return;
    state.sweep.running = false;
    clearInterval(sweepTimer);
    sweepTimer = null;
    render();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

Axis.addEventListener('keydown', (e) => {
    state.held[`${e.key}:${e.id}`] = true;
    setButtonLed(e.key, e.id, ECHO_COLOR);

    if (e.key === SWEEP_BUTTON.key && e.id === SWEEP_BUTTON.id) startSweep();

    render();
});

Axis.addEventListener('keyup', (e) => {
    delete state.held[`${e.key}:${e.id}`];
    setButtonLed(e.key, e.id, OFF_COLOR);

    if (e.key === SWEEP_BUTTON.key && e.id === SWEEP_BUTTON.id) pauseSweep();

    render();
});

// The launcher clears the strips when the page unloads; stop the timer so no
// command is issued after that.
window.addEventListener('beforeunload', () => {
    pauseSweep();
    ipcRenderer.send('led:clear');
});

buildButtons();
buildStrips();
render();
