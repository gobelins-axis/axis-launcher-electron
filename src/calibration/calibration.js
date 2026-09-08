/* eslint-env browser */
/* global require */

// Joystick calibration page.
//
// Behaves like a game: buttons and the Home / exit flow come from axis-api,
// the page is loaded in the main window by WindowManager. The only extras
// are the IPC channels described in src/managers/CalibrationManager.js:
// the raw joystick stream in, and get / apply / save / discard out.

const { ipcRenderer } = require('electron');
const Axis = require('axis-api').default;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const JOYSTICK_IDS = [1, 2];
const STEPS = ['intro', 'center', 'range', 'right', 'up', 'test'];

// Samples averaged for the rest position (~0.5 s at 50 msg/s).
const CENTER_SAMPLE_COUNT = 25;
// Minimum travel (raw counts) on both raw axes before the range step is accepted.
const MIN_RANGE_SPAN = 200;
// Minimum normalized deflection to accept a "push right" / "push up" sample.
const MIN_DIRECTION_DEFLECTION = 0.5;

const TEXTS = {
    intro: {
        instruction: (id) => `Calibrate joystick ${id}`,
        hint: 'Press A to start, S to skip this joystick',
    },
    center: {
        instruction: () => 'Release the joystick and let it rest at the centre',
        hint: 'Do not touch it, then press A',
    },
    range: {
        instruction: () => 'Rotate the joystick slowly along its outer edge, two or three full turns',
        hint: 'Push it all the way out, then press A',
    },
    right: {
        instruction: () => 'Push the joystick fully to the RIGHT',
        hint: 'Hold it there and press A',
    },
    up: {
        instruction: () => 'Push the joystick fully UP',
        hint: 'Hold it there and press A',
    },
    test: {
        instruction: () => 'Test the joystick',
        hint: 'The green dot is exactly what games will see. Press A to save.',
    },
    done: {
        instruction: () => 'Calibration complete',
        hint: 'Press A to return to the menu',
    },
};

// Keyboard emulation for development on a laptop (same mapping as the README).
Axis.registerKeys('q', 'a', 1);
Axis.registerKeys('d', 'x', 1);
Axis.registerKeys('z', 'i', 1);
Axis.registerKeys('s', 's', 1);
Axis.registerKeys(' ', 'w', 1);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
    joystickIndex: 0,
    stepIndex: 0,
    isDone: false,
    message: '',
    stored: {},
    raw: { 1: { x: 0, y: 0 }, 2: { x: 0, y: 0 } },
    hasSignal: { 1: false, 2: false },
    recentRaw: [],
    draft: createEmptyDraft(),
    preview: null,
};

const els = {
    title: document.querySelector('.js-title'),
    status: document.querySelector('.js-status'),
    steps: document.querySelector('.js-steps'),
    instruction: document.querySelector('.js-instruction'),
    hint: document.querySelector('.js-hint'),
    dot: document.querySelector('.js-dot'),
    rawX: document.querySelector('.js-raw-x'),
    rawY: document.querySelector('.js-raw-y'),
    preview: document.querySelector('.js-preview'),
    message: document.querySelector('.js-message'),
    controlA: document.querySelector('.js-control-a'),
    controlALabel: document.querySelector('.js-control-a-label'),
    controlX: document.querySelector('.js-control-x'),
    controlS: document.querySelector('.js-control-s'),
};

function currentJoystickId() {
    return JOYSTICK_IDS[state.joystickIndex];
}

function currentStep() {
    return state.isDone ? 'done' : STEPS[state.stepIndex];
}

function createEmptyDraft() {
    return {
        center: { a: 0, b: 0 },
        min: { a: 0, b: 0 },
        max: { a: 0, b: 0 },
        x: null,
        y: null,
    };
}

// Same formula as JoystickCalibration.normalizeAxis in the main process.
function normalizeAxis(value, center, min, max) {
    let n;
    if (value < center) n = (value - center) / Math.max(1, center - min);
    else n = (value - center) / Math.max(1, max - center);
    return Math.max(-1, Math.min(1, n));
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function confirm() {
    state.message = '';

    switch (currentStep()) {
        case 'intro': return nextStep();
        case 'center': return confirmCenter();
        case 'range': return confirmRange();
        case 'right': return confirmDirection('x', 'right');
        case 'up': return confirmDirection('y', 'up');
        case 'test': return save();
        case 'done': return ipcRenderer.send('exit');
        default: return null;
    }
}

function confirmCenter() {
    if (state.recentRaw.length < 5) {
        state.message = `No signal from joystick ${currentJoystickId()} yet`;
        return render();
    }

    const sum = state.recentRaw.reduce((acc, raw) => ({ x: acc.x + raw.x, y: acc.y + raw.y }), { x: 0, y: 0 });
    const center = { a: sum.x / state.recentRaw.length, b: sum.y / state.recentRaw.length };

    state.draft.center = center;
    // Range starts at the centre and expands while the user rotates the stick.
    state.draft.min = { ...center };
    state.draft.max = { ...center };

    nextStep();
}

function confirmRange() {
    const spanA = state.draft.max.a - state.draft.min.a;
    const spanB = state.draft.max.b - state.draft.min.b;

    if (spanA < MIN_RANGE_SPAN || spanB < MIN_RANGE_SPAN) {
        state.message = 'Not enough travel recorded, keep rotating the joystick to its limits';
        return render();
    }

    nextStep();
}

function confirmDirection(target, label) {
    const raw = state.raw[currentJoystickId()];
    const { center, min, max } = state.draft;

    const deflection = {
        a: normalizeAxis(raw.x, center.a, min.a, max.a),
        b: normalizeAxis(raw.y, center.b, min.b, max.b),
    };

    const axis = Math.abs(deflection.a) >= Math.abs(deflection.b) ? 'a' : 'b';
    const value = deflection[axis];

    if (Math.abs(value) < MIN_DIRECTION_DEFLECTION) {
        state.message = `Hold the joystick fully ${label} while pressing A`;
        return render();
    }

    const other = target === 'x' ? state.draft.y : state.draft.x;
    if (other && other.axis === axis) {
        state.message = `That is the same axis as before, push ${label} instead`;
        return render();
    }

    state.draft[target] = { axis, sign: value > 0 ? 1 : -1 };
    nextStep();
}

function nextStep() {
    state.stepIndex = Math.min(state.stepIndex + 1, STEPS.length - 1);

    if (currentStep() === 'test') {
        // From here on the main process maps this joystick with the draft,
        // so Axis.joystickN below reports what any game would get.
        ipcRenderer.send('calibration:apply', { id: currentJoystickId(), calibration: state.draft });
        state.preview = { x: 0, y: 0 };
    }

    render();
}

function restartJoystick() {
    ipcRenderer.send('calibration:discard', { id: currentJoystickId() });
    state.stepIndex = 0;
    state.draft = createEmptyDraft();
    state.preview = null;
    state.recentRaw = [];
    state.message = 'Restarted';
    render();
}

function skipJoystick() {
    if (currentStep() !== 'intro') return;
    state.message = '';
    nextJoystick();
}

function save() {
    ipcRenderer.send('calibration:save', { id: currentJoystickId() });
    state.stored[currentJoystickId()] = { ...state.draft, createdAt: new Date().toISOString() };
    nextJoystick();
}

function nextJoystick() {
    state.draft = createEmptyDraft();
    state.preview = null;
    state.recentRaw = [];
    state.stepIndex = 0;

    if (state.joystickIndex >= JOYSTICK_IDS.length - 1) {
        state.isDone = true;
    } else {
        state.joystickIndex++;
    }

    render();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderSteps() {
    const visibleSteps = STEPS.length - 1; // intro has no dot
    if (els.steps.children.length !== visibleSteps) {
        els.steps.innerHTML = '';
        for (let i = 0; i < visibleSteps; i++) els.steps.appendChild(document.createElement('span'));
    }

    const index = state.isDone ? visibleSteps : state.stepIndex - 1;
    Array.from(els.steps.children).forEach((el, i) => {
        el.classList.toggle('is-done', i < index);
        el.classList.toggle('is-current', i === index);
    });
}

function renderStatus() {
    const id = currentJoystickId();
    const stored = state.stored[id];
    if (state.isDone) {
        els.status.textContent = '';
    } else if (stored && stored.createdAt) {
        els.status.textContent = `Joystick ${id} last calibrated ${new Date(stored.createdAt).toLocaleString()}`;
    } else {
        els.status.textContent = `Joystick ${id} has never been calibrated (raw values are passed through)`;
    }
}

// Rough live dot from raw values, relative to the draft centre and the travel seen so far.
function rawDotPosition() {
    const step = currentStep();
    if (step === 'intro' || step === 'center') return null;

    const raw = state.raw[currentJoystickId()];
    const { center, min, max } = state.draft;
    const spanA = Math.max(1, (max.a - min.a) / 2);
    const spanB = Math.max(1, (max.b - min.b) / 2);
    const x = Math.max(-1, Math.min(1, (raw.x - center.a) / spanA));
    const y = Math.max(-1, Math.min(1, (raw.y - center.b) / spanB));
    return { x, y: -y };
}

function render() {
    const step = currentStep();
    const id = currentJoystickId();
    const texts = TEXTS[step];
    const raw = state.raw[id];

    els.title.textContent = state.isDone ? 'Joystick calibration' : `Joystick ${id} calibration`;
    els.instruction.textContent = texts.instruction(id);
    els.hint.textContent = texts.hint;
    els.message.textContent = state.message;
    els.rawX.textContent = state.hasSignal[id] ? raw.x : '–';
    els.rawY.textContent = state.hasSignal[id] ? raw.y : '–';

    renderSteps();
    renderStatus();

    const isPreview = step === 'test' && state.preview;
    const pos = isPreview ? state.preview : rawDotPosition();
    const radius = 15; // vh, half the pad minus the dot
    els.dot.classList.toggle('is-preview', Boolean(isPreview));
    els.dot.classList.toggle('is-hidden', !pos);
    if (pos) els.dot.style.transform = `translate(${pos.x * radius}vh, ${-pos.y * radius}vh)`;

    els.preview.textContent = isPreview
        ? `game x ${state.preview.x.toFixed(2)}  y ${state.preview.y.toFixed(2)}`
        : '';

    els.controlALabel.textContent = step === 'intro' ? 'Start' : step === 'test' ? 'Save' : step === 'done' ? 'Back to menu' : 'Confirm';
    els.controlX.classList.toggle('is-hidden', step === 'intro' || step === 'done');
    els.controlS.classList.toggle('is-hidden', step !== 'intro');
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

Axis.addEventListener('keydown', (e) => {
    if (e.key === 'a') confirm();
    if (e.key === 'x' && !state.isDone && currentStep() !== 'intro') restartJoystick();
    if (e.key === 's') skipJoystick();
});

// Live position through the real pipeline (draft applied in the main process).
JOYSTICK_IDS.forEach((id) => {
    Axis[`joystick${id}`].addEventListener('joystick:move', (e) => {
        if (id !== currentJoystickId() || currentStep() !== 'test') return;
        state.preview = { x: e.position.x, y: e.position.y };
        render();
    });
});

ipcRenderer.on('joystick:raw', (event, data) => {
    const { id, position } = data;
    if (!state.raw[id]) return;

    state.raw[id] = position;
    state.hasSignal[id] = true;

    if (id !== currentJoystickId()) return;

    state.recentRaw.push(position);
    if (state.recentRaw.length > CENTER_SAMPLE_COUNT) state.recentRaw.shift();

    if (currentStep() === 'range') {
        state.draft.min.a = Math.min(state.draft.min.a, position.x);
        state.draft.max.a = Math.max(state.draft.max.a, position.x);
        state.draft.min.b = Math.min(state.draft.min.b, position.y);
        state.draft.max.b = Math.max(state.draft.max.b, position.y);
    }

    render();
});

ipcRenderer.invoke('calibration:get').then((data) => {
    state.stored = (data && data.calibrations) || {};
    render();
}).catch(() => render());

render();
