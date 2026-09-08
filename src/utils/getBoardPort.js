// Vendor
const { SerialPort } = require('serialport');

// The controller board is a Teensy 4.1 (see ../../arduino/CLAUDE.md). In USB
// Serial mode it enumerates with PJRC's vendor id and the "USB Serial" product
// id, and reports "Teensyduino" as manufacturer. Ids are lowercase hex strings
// without the 0x prefix, as returned by SerialPort.list().
const TEENSY_VENDOR_ID = '16c0';
const TEENSY_SERIAL_PRODUCT_ID = '0483';

function isTeensy(port) {
    return (port.vendorId || '').toLowerCase() === TEENSY_VENDOR_ID;
}

function isTeensySerial(port) {
    return isTeensy(port) && (port.productId || '').toLowerCase() === TEENSY_SERIAL_PRODUCT_ID;
}

function describe(port) {
    const parts = [port.path];
    if (port.manufacturer) parts.push(port.manufacturer);
    if (port.vendorId) parts.push(`${port.vendorId}:${port.productId}`);
    if (port.serialNumber) parts.push(`sn ${port.serialNumber}`);
    return parts.join(' ');
}

/**
 * Finds the serial port of the controller board using the USB descriptors
 * exposed by SerialPort.list() rather than the port name, so other USB serial
 * devices (adapters, other boards, Bluetooth ports) are never picked.
 *
 * Selection order:
 *   1. a Teensy whose serial number matches `serialNumber`, when provided;
 *   2. the only Teensy in USB Serial mode;
 *   3. the only Teensy at all (other USB modes still expose a serial port).
 * Several matching boards without a serial number to disambiguate is an error,
 * so a wrong board is never silently chosen.
 *
 * @param {{ serialNumber?: string }} [options]
 * @returns {Promise<string>} the port path, e.g. /dev/cu.usbmodem12345
 */
module.exports = async function getBoardPort({ serialNumber } = {}) {
    console.log('⏳ Looking for the controller board...');

    const ports = await SerialPort.list();
    const teensies = ports.filter(isTeensy);

    if (teensies.length === 0) {
        const seen = ports.map((port) => `  - ${describe(port)}`).join('\n');
        throw new Error(`❌ No Teensy board found among serial ports:\n${seen}`);
    }

    let candidates = teensies;

    if (serialNumber) {
        const pinned = teensies.filter((port) => port.serialNumber === serialNumber);
        if (pinned.length === 1) return found(pinned[0]);
        console.log(`⚠️ No Teensy with serial number ${serialNumber}, falling back to detection`);
    }

    const serialMode = candidates.filter(isTeensySerial);
    if (serialMode.length > 0) candidates = serialMode;

    if (candidates.length > 1) {
        const seen = candidates.map((port) => `  - ${describe(port)}`).join('\n');
        throw new Error(`❌ Several Teensy boards found, pin one by serial number:\n${seen}`);
    }

    return found(candidates[0]);
};

function found(port) {
    console.log(`✅ Board found: ${describe(port)}\n`);
    return port.path;
}
