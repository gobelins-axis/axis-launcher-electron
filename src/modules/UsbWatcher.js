// Vendor
const { EventEmitter } = require('events');
const { usb } = require('usb');
const { SerialPort } = require('serialport');

// A serial port node can show up a moment after the USB connect event while
// macOS loads the driver: retry the lookup for a short while.
const RESOLVE_INTERVAL = 250;
const RESOLVE_TIMEOUT = 3000;

/**
 * Watches USB serial devices being plugged and unplugged.
 *
 * Hotplug events come from the `usb` package (WebUSB API, `connect` and
 * `disconnect`). They describe a USB device, not a serial port, so every event
 * is resolved to a port descriptor through `SerialPort.list()` by matching the
 * vendor id, product id and serial number. Only ports that belong to a USB
 * device are considered: Bluetooth and virtual ports have no vendor id.
 *
 * Events: `added` and `removed`, both with a serialport descriptor
 * (`{ path, vendorId, productId, serialNumber, manufacturer }`).
 *
 * The main board is excluded through `ignoredPaths`: it is opened once at
 * startup and is not meant to be unplugged while the machine runs.
 */
class UsbWatcher extends EventEmitter {
    constructor(options = {}) {
        super();

        // Props
        this._ignoredPaths = new Set((options.ignoredPaths || []).map(normalizePath));

        // Setup
        this._tracked = new Map(); // path -> descriptor
        this._bindAll();
    }

    /**
     * Public
     */
    async start() {
        usb.addEventListener('connect', this._connectHandler);
        usb.addEventListener('disconnect', this._disconnectHandler);

        // Devices plugged before the launcher started.
        const ports = await this._listUsbPorts();
        ports.forEach((port) => this._add(port));
    }

    stop() {
        usb.removeEventListener('connect', this._connectHandler);
        usb.removeEventListener('disconnect', this._disconnectHandler);
    }

    get devices() {
        return Array.from(this._tracked.values());
    }

    /**
     * Private
     */
    _bindAll() {
        this._connectHandler = this._connectHandler.bind(this);
        this._disconnectHandler = this._disconnectHandler.bind(this);
    }

    async _listUsbPorts() {
        const ports = await SerialPort.list();
        return ports
            .filter((port) => port.vendorId)
            .map((port) => ({ ...port, path: normalizePath(port.path) }))
            .filter((port) => !this._ignoredPaths.has(port.path));
    }

    _add(port) {
        if (this._tracked.has(port.path)) return;
        this._tracked.set(port.path, port);
        this.emit('added', port);
    }

    _remove(path) {
        const port = this._tracked.get(path);
        if (!port) return;
        this._tracked.delete(path);
        this.emit('removed', port);
    }

    /**
     * Handlers
     */
    async _connectHandler(event) {
        const device = event.device;
        const deadline = Date.now() + RESOLVE_TIMEOUT;

        while (Date.now() < deadline) {
            const ports = await this._listUsbPorts();
            const match = ports.find((port) => matches(port, device) && !this._tracked.has(port.path));
            if (match) {
                this._add(match);
                return;
            }
            await wait(RESOLVE_INTERVAL);
        }

        // Not a serial device (mouse, hub...), or one we already ignore.
    }

    async _disconnectHandler() {
        // Whatever left, a fresh listing tells us which tracked ports are gone.
        const ports = await this._listUsbPorts();
        const present = new Set(ports.map((port) => port.path));
        Array.from(this._tracked.keys())
            .filter((path) => !present.has(path))
            .forEach((path) => this._remove(path));
    }
}

// serialport lists `/dev/tty.*` on macOS; the `cu.` twin is the one to open
// (no modem-control semantics). Both name the same device.
function normalizePath(path) {
    return path.replace('/dev/tty.', '/dev/cu.');
}

function matches(port, device) {
    if (parseInt(port.vendorId, 16) !== device.vendorId) return false;
    if (parseInt(port.productId, 16) !== device.productId) return false;
    // Some chips (CH340) have no serial number: vendor and product are enough.
    if (port.serialNumber && device.serialNumber && port.serialNumber !== device.serialNumber) return false;
    return true;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = UsbWatcher;
