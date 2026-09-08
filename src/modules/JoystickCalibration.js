// Vendor
const fs = require('fs');
const path = require('path');

// Utils
const clamp = require('../utils/clamp');

/**
 * Wire format every game expects for joystick positions.
 *
 * All game bundles embed axis-api's normalizeJoystickSignal, which maps
 * x from 18..840 and y from 36..867 to -1..1 and inverts y. Those numbers
 * were measured on the original stick and can never change without
 * rebuilding every game, so the launcher always speaks this format,
 * whatever the physical stick actually outputs.
 */
const LEGACY_RANGE = {
    x: { min: 18, max: 840 },
    y: { min: 36, max: 867 },
};

const LEGACY_CENTER = {
    x: (LEGACY_RANGE.x.min + LEGACY_RANGE.x.max) / 2,
    y: (LEGACY_RANGE.y.min + LEGACY_RANGE.y.max) / 2,
};

const LEGACY_HALF_RANGE = {
    x: (LEGACY_RANGE.x.max - LEGACY_RANGE.x.min) / 2,
    y: (LEGACY_RANGE.y.max - LEGACY_RANGE.y.min) / 2,
};

/**
 * Stored calibration for one joystick id.
 *
 * Raw axes are named "a" (the x field sent by the board) and "b" (the y
 * field). The calibration page measures which raw axis is horizontal /
 * vertical and in which direction, so wiring order never matters.
 *
 * {
 *   center: { a, b },
 *   min:    { a, b },
 *   max:    { a, b },
 *   x: { axis: 'a' | 'b', sign: 1 | -1 },   // +1 = right
 *   y: { axis: 'a' | 'b', sign: 1 | -1 },   // +1 = up
 *   createdAt: ISO string
 * }
 *
 * A "draft" is a calibration applied temporarily (while the calibration
 * page previews it) that is not written to disk until committed.
 */
class JoystickCalibration {
    constructor(options = {}) {
        // Props
        this._filePath = options.filePath;

        // Setup
        this._calibrations = this._load();
        this._drafts = {};
    }

    /**
     * Getters
     */
    get filePath() {
        return this._filePath;
    }

    /**
     * Public: stored calibrations
     */
    has(id) {
        return Boolean(this._calibrations[String(id)]);
    }

    get(id) {
        return this._calibrations[String(id)] || null;
    }

    getAll() {
        return { ...this._calibrations };
    }

    set(id, calibration) {
        this._calibrations[String(id)] = { ...calibration, createdAt: new Date().toISOString() };
        this._save();
    }

    clear(id) {
        delete this._calibrations[String(id)];
        this._save();
    }

    /**
     * Public: drafts
     */
    setDraft(id, calibration) {
        this._drafts[String(id)] = calibration;
    }

    hasDraft(id) {
        return Boolean(this._drafts[String(id)]);
    }

    commitDraft(id) {
        const draft = this._drafts[String(id)];
        if (!draft) return false;

        delete this._drafts[String(id)];
        this.set(id, draft);
        return true;
    }

    discardDraft(id) {
        delete this._drafts[String(id)];
    }

    discardAllDrafts() {
        this._drafts = {};
    }

    /**
     * Raw board values -> normalized { x, y } in -1..1, +x right, +y up.
     * A draft takes precedence over the stored calibration.
     * Returns null when the joystick has neither.
     */
    normalize(id, raw) {
        const calibration = this._drafts[String(id)] || this._calibrations[String(id)];
        if (!calibration) return null;

        return JoystickCalibration.normalizeWith(calibration, raw);
    }

    /**
     * Raw board values -> values in the legacy wire format for the games.
     * Pass-through when the joystick has no calibration, so behaviour is
     * unchanged until someone runs the calibration page.
     */
    map(id, raw) {
        const normalized = this.normalize(id, raw);
        if (!normalized) return { x: raw.x, y: raw.y };

        return JoystickCalibration.toLegacy(normalized);
    }

    /**
     * Static helpers (pure)
     */
    static normalizeAxis(value, center, min, max) {
        let n;
        if (value < center) n = (value - center) / Math.max(1, center - min);
        else n = (value - center) / Math.max(1, max - center);
        return clamp(n, -1, 1);
    }

    static normalizeWith(calibration, raw) {
        const rawByAxis = { a: raw.x, b: raw.y };

        const axisValue = (axis) => {
            return JoystickCalibration.normalizeAxis(
                rawByAxis[axis],
                calibration.center[axis],
                calibration.min[axis],
                calibration.max[axis],
            );
        };

        return {
            x: axisValue(calibration.x.axis) * calibration.x.sign,
            y: axisValue(calibration.y.axis) * calibration.y.sign,
        };
    }

    static toLegacy(normalized) {
        // Games apply DIRECTION_Y = -1, so "up" must be sent as a low value.
        return {
            x: Math.round(LEGACY_CENTER.x + normalized.x * LEGACY_HALF_RANGE.x),
            y: Math.round(LEGACY_CENTER.y - normalized.y * LEGACY_HALF_RANGE.y),
        };
    }

    /**
     * What a game computes from a legacy value (before its deadzone).
     */
    static fromLegacy(legacy) {
        return {
            x: (legacy.x - LEGACY_CENTER.x) / LEGACY_HALF_RANGE.x,
            y: -(legacy.y - LEGACY_CENTER.y) / LEGACY_HALF_RANGE.y,
        };
    }

    /**
     * Private
     */
    _load() {
        try {
            if (!this._filePath || !fs.existsSync(this._filePath)) return {};
            const content = fs.readFileSync(this._filePath, 'utf8');
            const parsed = JSON.parse(content);
            console.log(`🕹  Joystick calibration loaded from ${this._filePath}`);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            console.error('Could not read joystick calibration, using pass-through', error);
            return {};
        }
    }

    _save() {
        if (!this._filePath) return;
        try {
            fs.mkdirSync(path.dirname(this._filePath), { recursive: true });
            fs.writeFileSync(this._filePath, JSON.stringify(this._calibrations, null, 4));
            console.log(`🕹  Joystick calibration saved to ${this._filePath}`);
        } catch (error) {
            console.error('Could not save joystick calibration', error);
        }
    }
}

JoystickCalibration.LEGACY_RANGE = LEGACY_RANGE;

module.exports = JoystickCalibration;
