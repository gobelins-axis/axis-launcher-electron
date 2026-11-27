/* eslint-env browser */
/* global require */

// Joystick calibration page.
//
// Behaves like a game: buttons and the Home / exit flow come from axis-api,
// the page is loaded in the main window by WindowManager. The only extras
// are the IPC channels described in src/managers/CalibrationManager.js:
// the raw joystick stream in, and get / apply / save / discard out.
//
// Two views:
//   overview     both joysticks live, as games see them (stored calibration)
//   calibration  one joystick at a time: intro, center, range, right, up, test

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
// Dot travel inside a pad, in vh (half the pad minus the dot).
const DOT_RADIUS = 15;

const TEXTS = {
    intro: {
        instruction: (id) => `Calibrate joystick ${id}`,
        hint: 'Press A to start, or S to skip this joystick',
    },
    center: {
        instruction: (id) => `Let joystick ${id} rest at the centre`,
        hint: 'Do not touch it, then press A',
    },
    range: {
        instruction: (id) => `Make two or three wide circles with joystick ${id}`,
        hint: 'Then press A',
    },
    right: {
        instruction: (id) => `Push joystick ${id} fully to the right`,
        hint: 'Hold it there and press A',
    },
    up: {
        instruction: (id) => `Push joystick ${id} fully up`,
        hint: 'Hold it there and press A',
    },
    test: {
        instruction: (id) => `Try joystick ${id}`,
        hint: 'The white dot is what games will see. Press A to save, X to start over.',
    },
    done: {
        instruction: () => 'Calibration saved',
        hint: 'Press A to check both joysticks, or exit with Home',
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
    view: 'overview', // 'overview' | 'calibration'
    joystickIndex: 0,
    stepIndex: 0,
    isDone: false,
    message: '',
    stored: {},
    raw: { 1: { x: 0, y: 0 }, 2: { x: 0, y: 0 } },
    game: { 1: { x: 0, y: 0 }, 2: { x: 0, y: 0 } },
    hasSignal: { 1: false, 2: false },
    recentRaw: [],
    draft: createEmptyDraft(),
    preview: null,
};

const els = {
    status: document.querySelector('.js-status'),
    steps: document.querySelector('.js-steps'),
    inputs: document.querySelector('.js-inputs'),
    viewOverview: document.querySelector('.js-view-overview'),
    viewCalibration: document.querySelector('.js-view-calibration'),
    instruction: document.querySelector('.js-instruction'),
    hint: document.querySelector('.js-hint'),
    dot: document.querySelector('.js-dot'),
    dotRaw: document.querySelector('.js-dot-raw'),
    rawX: document.querySelector('.js-raw-x'),
    rawY: document.querySelector('.js-raw-y'),
    previewRow: document.querySelector('.js-preview-row'),
    previewX: document.querySelector('.js-preview-x'),
    previewY: document.querySelector('.js-preview-y'),
    message: document.querySelector('.js-message'),
    overview: {},
};

JOYSTICK_IDS.forEach((id) => {
    const root = document.querySelector(`.overview-joystick[data-joystick="${id}"]`);
    els.overview[id] = {
        dot: root.querySelector('.js-overview-dot'),
        dotRaw: root.querySelector('.js-overview-dot-raw'),
        gameX: root.querySelector('.js-overview-game-x'),
        gameY: root.querySelector('.js-overview-game-y'),
        rawX: root.querySelector('.js-overview-raw-x'),
        rawY: root.querySelector('.js-overview-raw-y'),
        calibrated: root.querySelector('.js-overview-calibrated'),
    };
});

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

function moveDot(el, pos) {
    el.style.transform = `translate(${pos.x * DOT_RADIUS}vh, ${-pos.y * DOT_RADIUS}vh)`;
}

// Raw 0..1023 -> -1..1 with 512 at the centre, low raw y shown as up
// (same convention as the games' DIRECTION_Y).
function rawToPad(raw) {
    return {
        x: (raw.x - 511.5) / 511.5,
        y: -(raw.y - 511.5) / 511.5,
    };
}

// ---------------------------------------------------------------------------
// Input indicators (same pattern as axis-launcher-front's Inputs component)
// ---------------------------------------------------------------------------

const INPUT_SWITCH_OUT_MS = 100;
let currentInputsKey = '';
let inputsSwitchTimeout = null;

function buildInputIndicator(input) {
    const indicator = document.createElement('div');
    indicator.className = 'input-indicator';

    // Glyphs live in ./icons/input-*.svg (same files as the front's assets/icons)
    const icon = document.createElement('img');
    icon.className = 'input-icon';
    icon.src = `./icons/input-${input.key}.svg`;
    icon.alt = '';
    indicator.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = input.label;
    indicator.appendChild(label);

    return indicator;
}

function setInputs(inputs) {
    const key = JSON.stringify(inputs);
    if (key === currentInputsKey) return;
    currentInputsKey = key;

    const apply = () => {
        els.inputs.innerHTML = '';
        inputs.forEach((input) => els.inputs.appendChild(buildInputIndicator(input)));
        els.inputs.classList.remove('is-switching');
    };

    clearTimeout(inputsSwitchTimeout);

    if (!els.inputs.children.length) return apply();

    els.inputs.classList.add('is-switching');
    inputsSwitchTimeout = setTimeout(apply, INPUT_SWITCH_OUT_MS);
}

function inputsForState() {
    const exit = { key: 'home', label: 'Exit' };
    if (state.view === 'overview') return [{ key: 'a', label: 'Calibrate' }, exit];

    switch (currentStep()) {
        case 'intro': return [{ key: 'a', label: 'Start' }, { key: 's', label: 'Skip this joystick' }, exit];
        case 'test': return [{ key: 'a', label: 'Save' }, { key: 'x', label: 'Restart' }, exit];
        case 'done': return [{ key: 'a', label: 'Check joysticks' }, exit];
        default: return [{ key: 'a', label: 'Confirm' }, { key: 'x', label: 'Restart' }, exit];
    }
}

function calibratedLabel(id) {
    const stored = state.stored[id];
    if (stored && stored.createdAt) return `Calibrated ${new Date(stored.createdAt).toLocaleString()}`;
    return 'Never calibrated, raw values passed through';
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function showOverview() {
    state.view = 'overview';
    state.isDone = false;
    state.joystickIndex = 0;
    state.stepIndex = 0;
    state.message = '';
    state.draft = createEmptyDraft();
    state.preview = null;
    state.recentRaw = [];
    render();
}

function startCalibration() {
    state.view = 'calibration';
    state.isDone = false;
    state.joystickIndex = 0;
    state.stepIndex = 0;
    state.message = '';
    state.draft = createEmptyDraft();
    state.preview = null;
    state.recentRaw = [];
    render();
}

// ---------------------------------------------------------------------------
// Calibration steps
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
        case 'done': return showOverview();
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
        state.message = 'Not enough travel recorded. Keep the stick tilted all the way and make a few more circles, then press A';
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

function renderOverview() {
    els.status.textContent = '';
    els.steps.innerHTML = '';

    JOYSTICK_IDS.forEach((id) => {
        const ui = els.overview[id];
        const game = state.game[id];
        const raw = state.raw[id];
        const hasSignal = state.hasSignal[id];

        moveDot(ui.dot, game);
        ui.dotRaw.classList.toggle('is-hidden', !hasSignal);
        if (hasSignal) moveDot(ui.dotRaw, rawToPad(raw));
        ui.gameX.textContent = game.x.toFixed(2);
        ui.gameY.textContent = game.y.toFixed(2);
        ui.rawX.textContent = hasSignal ? raw.x : '–';
        ui.rawY.textContent = hasSignal ? raw.y : '–';

        ui.calibrated.textContent = hasSignal ? calibratedLabel(id) : 'No signal from the board';
        ui.calibrated.classList.toggle('is-missing', hasSignal && !state.stored[id]);
        ui.calibrated.classList.toggle('no-signal', !hasSignal);
    });
}

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

// Live dot from raw values. Before a centre has been captured (intro, centre,
// done) it is the plain raw mapping; afterwards it is relative to the draft
// centre and the travel seen so far, so the user sees the calibration forming.
function rawDotPosition() {
    const step = currentStep();
    const raw = state.raw[currentJoystickId()];
    if (!state.hasSignal[currentJoystickId()]) return null;
    if (step === 'intro' || step === 'center' || step === 'done') return rawToPad(raw);

    const { center, min, max } = state.draft;
    const spanA = Math.max(1, (max.a - min.a) / 2);
    const spanB = Math.max(1, (max.b - min.b) / 2);
    const x = Math.max(-1, Math.min(1, (raw.x - center.a) / spanA));
    const y = Math.max(-1, Math.min(1, (raw.y - center.b) / spanB));
    return { x, y: -y };
}

function renderCalibration() {
    const step = currentStep();
    const id = currentJoystickId();
    const texts = TEXTS[step];
    const raw = state.raw[id];

    els.status.textContent = state.isDone ? '' : `Joystick ${id}: ${calibratedLabel(id)}`;
    els.instruction.textContent = texts.instruction(id);
    els.hint.textContent = texts.hint;
    els.message.textContent = state.message;
    els.rawX.textContent = state.hasSignal[id] ? raw.x : '–';
    els.rawY.textContent = state.hasSignal[id] ? raw.y : '–';

    renderSteps();

    const isPreview = step === 'test' && state.preview;
    const pos = isPreview ? state.preview : rawDotPosition();
    els.dot.classList.toggle('is-preview', Boolean(isPreview));
    els.dot.classList.toggle('is-hidden', !pos);
    if (pos) moveDot(els.dot, pos);

    // Grey raw dot at every step, so the board signal is always visible even
    // when the white dot is relative to the calibration being built.
    const showRaw = state.hasSignal[id];
    els.dotRaw.classList.toggle('is-hidden', !showRaw);
    if (showRaw) moveDot(els.dotRaw, rawToPad(raw));

    els.previewRow.hidden = !isPreview;
    if (isPreview) {
        els.previewX.textContent = state.preview.x.toFixed(2);
        els.previewY.textContent = state.preview.y.toFixed(2);
    }
}

function render() {
    const isOverview = state.view === 'overview';
    els.viewOverview.hidden = !isOverview;
    els.viewCalibration.hidden = isOverview;

    if (isOverview) renderOverview();
    else renderCalibration();

    setInputs(inputsForState());
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

Axis.addEventListener('keydown', (e) => {
    if (state.view === 'overview') {
        if (e.key === 'a') startCalibration();
        return;
    }

    if (e.key === 'a') confirm();
    if (e.key === 'x' && !state.isDone && currentStep() !== 'intro') restartJoystick();
    if (e.key === 's') skipJoystick();
});

// Positions through the real pipeline: stored calibration on the overview,
// the draft applied in the main process during the test step.
JOYSTICK_IDS.forEach((id) => {
    Axis[`joystick${id}`].addEventListener('joystick:move', (e) => {
        state.game[id] = { x: e.position.x, y: e.position.y };

        if (state.view === 'overview') return render();

        if (id === currentJoystickId() && currentStep() === 'test') {
            state.preview = state.game[id];
            render();
        }
    });
});

ipcRenderer.on('joystick:raw', (event, data) => {
    const { id, position } = data;
    if (!state.raw[id]) return;

    state.raw[id] = position;
    state.hasSignal[id] = true;

    if (state.view === 'overview') return render();
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
