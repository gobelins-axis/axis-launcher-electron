/**
 * Parses one line of the board protocol into an object.
 *
 *   'type:button__key:a__id:1__state:keydown'
 *   -> { type: 'button', key: 'a', id: '1', state: 'keydown' }
 *
 * Fields are split on `__`, key and value on the first `:`. Values stay
 * strings; callers convert what they need. Malformed fields are skipped, so a
 * noisy line (boot messages, garbage at the wrong baud) yields an object
 * without `type` and is ignored downstream.
 *
 * Shared by the main board (ControllerManager) and alternative controllers.
 */
module.exports = function parseMessage(line) {
    const data = {};
    if (typeof line !== 'string') return data;

    line.split('__').forEach((field) => {
        const separator = field.indexOf(':');
        if (separator <= 0) return;
        data[field.slice(0, separator)] = field.slice(separator + 1);
    });

    return data;
};
