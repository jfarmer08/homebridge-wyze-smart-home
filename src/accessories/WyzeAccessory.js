const { Service, Characteristic } = require("../types");
const { ModelNames } = require("../enums");

// Responses from the Wyze API can lag a little after a new value is set
const UPDATE_THROTTLE_MS = 1000;

module.exports = class WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    this.updating = false;
    this.lastTimestamp = null;
    this.lastDevice = null;

    this.plugin = plugin;
    this.homeKitAccessory = homeKitAccessory;
  }

  // Default Prop
  get display_name() {
    return this.homeKitAccessory.displayName;
  }
  get mac() {
    return this.homeKitAccessory.context.mac;
  }
  get product_type() {
    return this.homeKitAccessory.context.product_type;
  }
  get product_model() {
    return this.homeKitAccessory.context.product_model;
  }
  get model_name() {
    return ModelNames[this.product_model] || this.product_model;
  }

  /** Determines whether this accessory matches the given Wyze device */
  matches(device) {
    return this.mac === device.mac;
  }

  async update(device, timestamp) {
    // Cache the freshest device payload so accessories can read live fields
    // (device_params, camera_thumbnails, etc.) without re-fetching the
    // device list from Wyze on every characteristic read.
    this.device = device;

    // Merge identifying fields into context — DON'T replace the whole
    // object, since accessories also stash persisted state in
    // context.lastState that needs to survive across refreshes (and
    // reboots — homebridge serializes context to disk for cached
    // accessories).
    Object.assign(this.homeKitAccessory.context, {
      mac: device.mac,
      product_type: device.product_type,
      product_model: device.product_model,
      nickname: device.nickname,
    });

    this.homeKitAccessory
      .getService(Service.AccessoryInformation)
      .updateCharacteristic(Characteristic.Name, device.nickname)
      .updateCharacteristic(Characteristic.Manufacturer, "Wyze")
      .updateCharacteristic(Characteristic.Model, device.product_model)
      .updateCharacteristic(Characteristic.SerialNumber, device.mac)
      .updateCharacteristic(
        Characteristic.FirmwareRevision,
        device.firmware_ver
      );

    this.lastDevice = device;
    if (this.shouldUpdateCharacteristics(timestamp)) {
      this.lastTimestamp = timestamp;
      this.updating = true;
      try {
        // Promise.resolve wraps both sync-return and async-return uniformly.
        // The outer try/catch is required: if updateCharacteristics() throws
        // synchronously, the throw escapes Promise.resolve() before .catch()
        // is attached, which would turn update() into an unhandled rejection.
        Promise.resolve(this.updateCharacteristics(device))
          .catch(e => {
            if (this.plugin?.log?.error)
              this.plugin.log.error(`[${this.product_type}] Error updating "${this.display_name}": ${e}`);
          })
          .finally(() => { this.updating = false; });
      } catch (e) {
        this.updating = false;
        if (this.plugin?.log?.error)
          this.plugin.log.error(`[${this.product_type}] Error updating "${this.display_name}": ${e}`);
      }
    }
  }
  shouldUpdateCharacteristics(timestamp) {
    if (this.updating) {
      return false;
    }

    if (
      this.lastTimestamp &&
      timestamp <= this.lastTimestamp + UPDATE_THROTTLE_MS
    ) {
      return false;
    }

    return true;
  }

  updateCharacteristics(device) {
    //
  }

  /**
   * Read state previously saved to homeKitAccessory.context.lastState by
   * persistState(). Survives plugin restarts because homebridge serializes
   * the accessory context to disk for cached accessories. Returns an empty
   * object on first run.
   */
  loadPersistedState() {
    return this.homeKitAccessory.context.lastState || {};
  }

  /**
   * Merge `state` into homeKitAccessory.context.lastState AND flush the
   * cached-accessory file to disk so the value survives even an
   * unclean shutdown (kill, crash). Without the explicit
   * updatePlatformAccessories call, homebridge only writes the cache
   * on clean SIGTERM — and the user just restarting from the UI counts
   * as unclean for our purposes.
   *
   * Pass partial updates — only the keys you provide are overwritten.
   * Skipped silently if `state` is identical to what's already cached
   * (avoids unnecessary disk writes every refresh cycle).
   */
  persistState(state) {
    const prev = this.homeKitAccessory.context.lastState || {};
    let changed = false;
    for (const k of Object.keys(state)) {
      if (prev[k] !== state[k]) { changed = true; break; }
    }
    if (!changed) return;

    this.homeKitAccessory.context.lastState = { ...prev, ...state };

    // Flush. Only valid for bridged accessories — externals (cameras)
    // are persisted differently, so we no-op on those without erroring.
    try {
      this.plugin.api.updatePlatformAccessories?.([this.homeKitAccessory]);
    } catch (_) {
      // Likely an external accessory or homebridge variant that doesn't
      // expose updatePlatformAccessories. Context mutation is in memory
      // and will still be saved on clean shutdown.
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Optimistic-update grace period: after firing a command, arm this for the
  // command's expected propagation time so a poll landing before the Wyze API
  // catches up doesn't revert the optimistic HomeKit state back to stale data.
  armCommandGrace(ms) {
    this._commandGraceUntil = Date.now() + ms;
  }

  // Call when a command is known to have failed so the next poll (rather than
  // the full grace window) is free to correct the optimistic state.
  clearCommandGrace() {
    this._commandGraceUntil = 0;
  }

  inCommandGrace() {
    return Date.now() <= (this._commandGraceUntil || 0);
  }
};
