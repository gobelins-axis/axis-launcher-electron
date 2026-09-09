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
//   - Strip sweep: while W of controller 1 is held, the left strip lights up
//     one LED at a time; W of controller 2 does the same on the right strip.
//     At the end a sweep restarts from the top with the next colour: red,
//     green, blue, red... Each strip has its own sweep, so a strip lighting
//     when the other controller's W is held points at a wiring swap.

const { ipcRenderer } = require('electron');
const Axis = require('axis-api').default;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ECHO_COLOR = 'white';
const OFF_COLOR = 'black';

// Which controller's W drives which strip.
const SWEEP_BUTTONS = {
    left: { key: 'w', id: 1 },
    right: { key: 'w', id: 2 },
};
const SIDES = Object.keys(SWEEP_BUTTONS);
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

function createSweep(length) {
    return {
        running: false,
        timer: null,
        index: 0, // next LED to light
        colorIndex: 0,
        passes: 0,
        cells: new Array(length).fill(null), // colour name per LED, mirrors the strip
    };
}

const state = {
    held: {}, // "key:id" -> true while pressed
    sweeps: {
        left: createSweep(strips.left.leds.length),
        right: createSweep(strips.right.leds.length),
    },
    sent: 0, // LED commands issued, for the footer counter
};

const els = {
    buttons: {},
    cells: { left: [], right: [] },
    sweeps: {},
    sent: document.querySelector('.js-sent'),
};

SIDES.forEach((side) => {
    els.sweeps[side] = {
        status: document.querySelector(`.js-sweep-status-${side}`),
        color: document.querySelector(`.js-sweep-color-${side}`),
        index: document.querySelector(`.js-sweep-index-${side}`),
        passes: document.querySelector(`.js-sweep-passes-${side}`),
    };
});

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
    SIDES.forEach((side) => {
        const bar = document.querySelector(`.js-strip-${side}`);
        for (let i = 0; i < strips[side].leds.length; i++) {
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

    SIDES.forEach((side) => {
        const sweep = state.sweeps[side];
        const length = sweep.cells.length;

        for (let i = 0; i < length; i++) {
            const color = sweep.cells[i];
            const cell = els.cells[side][i];
            cell.style.background = color ? SWEEP_COLORS.find((c) => c.name === color).css : '';
            cell.classList.toggle('is-next', sweep.running && i === sweep.index);
        }

        const ui = els.sweeps[side];
        ui.status.textContent = sweep.running ? 'Sweeping' : `Paused, hold W on controller ${SWEEP_BUTTONS[side].id}`;
        ui.color.textContent = SWEEP_COLORS[sweep.colorIndex].name;
        ui.index.textContent = `${sweep.index} / ${length}`;
        ui.passes.textContent = String(sweep.passes);
    });

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

function setStripLed(side, index, color) {
    strips[side].leds[index].setColor(color);
    state.sent++;
}

function sweepStep(side) {
    const sweep = state.sweeps[side];
    const color = SWEEP_COLORS[sweep.colorIndex];

    setStripLed(side, sweep.index, color.css);
    sweep.cells[sweep.index] = color.name;
    sweep.index++;

    if (sweep.index >= sweep.cells.length) {
        // End of the strip: restart from the top with the next colour,
        // overwriting the previous pass LED by LED.
        sweep.index = 0;
        sweep.colorIndex = (sweep.colorIndex + 1) % SWEEP_COLORS.length;
        sweep.passes++;
    }

    render();
}

function startSweep(side) {
    const sweep = state.sweeps[side];
    if (sweep.running) return;
    sweep.running = true;
    sweepStep(side);
    sweep.timer = setInterval(() => sweepStep(side), SWEEP_STEP_MS);
    render();
}

function pauseSweep(side) {
    const sweep = state.sweeps[side];
    if (!sweep.running) return;
    sweep.running = false;
    clearInterval(sweep.timer);
    sweep.timer = null;
    render();
}

// The strip whose sweep button matches this event, if any.
function sweepSideFor(e) {
    return SIDES.find((side) => SWEEP_BUTTONS[side].key === e.key && SWEEP_BUTTONS[side].id === e.id);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

Axis.addEventListener('keydown', (e) => {
    state.held[`${e.key}:${e.id}`] = true;
    setButtonLed(e.key, e.id, ECHO_COLOR);

    const side = sweepSideFor(e);
    if (side) startSweep(side);

    render();
});

Axis.addEventListener('keyup', (e) => {
    delete state.held[`${e.key}:${e.id}`];
    setButtonLed(e.key, e.id, OFF_COLOR);

    const side = sweepSideFor(e);
    if (side) pauseSweep(side);

    render();
});

// The launcher clears the strips when the page unloads; stop the timer so no
// command is issued after that.
window.addEventListener('beforeunload', () => {
    SIDES.forEach(pauseSweep);
    ipcRenderer.send('led:clear');
});

buildButtons();
buildStrips();
render();
