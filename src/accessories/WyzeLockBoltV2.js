const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeLockBoltV2 extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Restore from disk so HomeKit shows real lock state immediately on
    // reboot. Default to "locked" (the safer assumption) and "closed"
    // for a brand-new install where we have no prior reading yet.
    const persisted = this.loadPersistedState();
    this.isLocked = persisted.isLocked ?? true;
    this.isDoorOpen = persisted.isDoorOpen ?? false;
    this.batteryLevel = persisted.batteryLevel ?? 100;
    this.chargingState = persisted.chargingState ?? 0;
    this.firmwareVersion = persisted.firmwareVersion ?? "";

    this.lockService = this._getOrAddService(Service.LockMechanism, "LockMechanism");
    this.contactService = this._getOrAddService(Service.ContactSensor, "Door Contact");
    this.batteryService = this._getOrAddService(Service.Battery, "Battery");

    this.lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .onGet(this.getLockCurrentState.bind(this));
    this.lockService
      .getCharacteristic(Characteristic.LockTargetState)
      .onGet(this.getLockTargetState.bind(this))
      .onSet(this.setLockTargetState.bind(this));

    this.contactService
      .getCharacteristic(Characteristic.ContactSensorState)
      .onGet(this.getDoorStatus.bind(this));

    this.batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));
    this.batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(this.getLowBatteryStatus.bind(this));
    this.batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .onGet(this.getChargingState.bind(this));
  }

  _getOrAddService(ServiceType, label) {
    let service = this.homeKitAccessory.getService(ServiceType);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[LockBoltV2] [${label}] Adding service for "${this.display_name} (${this.mac})"`);
      service = this.homeKitAccessory.addService(ServiceType);
    }
    return service;
  }

  async updateCharacteristics(device) {
    // Lock is safety-critical — use StatusFault (⚠️) to flag stale data
    // without hiding the last known lock state behind the unreachable banner.
    const online = device.conn_state !== 0;
    markServiceOnline(this.lockService, online, "fault");

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] "${this.display_name} (${this.mac})" is offline — keeping last known state, marked with fault`
        );
      return false;
    }

    // NOTE: one extra IoT3 call per refresh (lockBoltV2GetProperties) on
    // top of the bulk getObjectList. Bulk list doesn't include lock state.
    //
    // Palm Lock (DX_PVLOC) intentionally uses lockBoltV2GetProperties too —
    // it supports all 6 props, whereas palmLockGetProperties in wyze-api is
    // missing door-status + power-source.
    let result;
    try {
      result = await this.plugin.client.lockBoltV2GetProperties(this.mac, this.product_model);
    } catch (e) {
      this.plugin.log.error(
        `[LockBoltV2] Update failed for "${this.display_name}": ${e.message || e}`
      );
      markServiceOnline(this.lockService, false, "fault");
      return false;
    }

    if (result?.code !== "1") {
      this.plugin.log.warn?.(
        `[LockBoltV2] IoT3 returned code ${result?.code} for "${this.display_name}": ${result?.msg}`
      );
      return false;
    }

    const props = result.data?.props || {};

    // iot-device::iot-state reflects live connectivity — catches disconnects
    // faster than device.conn_state which only updates on the slow poll.
    if (props["iot-device::iot-state"] !== undefined && !props["iot-device::iot-state"]) {
      markServiceOnline(this.lockService, false, "fault");
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] "${this.display_name} (${this.mac})" offline per IoT3 iot-state`
        );
      return false;
    }

    let changed = false;
    if (props["lock::lock-status"] !== undefined) {
      // Skip during grace period after a command to avoid reverting an
      // optimistic update before the API has propagated the change.
      if (!this.inCommandGrace()) {
        const newLocked = !!props["lock::lock-status"];
        changed = this.isLocked !== newLocked;
        this.isLocked = newLocked;
        this.lockService
          .getCharacteristic(Characteristic.LockCurrentState)
          .updateValue(this.isLocked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
        this.lockService
          .getCharacteristic(Characteristic.LockTargetState)
          .updateValue(this.isLocked ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);
      }
    }

    if (props["lock::door-status"] !== undefined) {
      // door-status: true = door closed (contact detected), false = open.
      this.isDoorOpen = !props["lock::door-status"];
      this.contactService
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue(
          this.isDoorOpen
            ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
            : Characteristic.ContactSensorState.CONTACT_DETECTED
        );
    }

    if (props["battery::battery-level"] !== undefined) {
      this.batteryLevel = props["battery::battery-level"];
      this.batteryService
        .getCharacteristic(Characteristic.BatteryLevel)
        .updateValue(this.plugin.client.checkBatteryVoltage(this.batteryLevel));
      this.batteryService
        .getCharacteristic(Characteristic.StatusLowBattery)
        .updateValue(this.plugin.client.checkLowBattery(this.batteryLevel));
    }

    if (props["battery::power-source"] !== undefined) {
      // power-source: 1 = battery (not charging), 2 = USB/charging (inferred)
      this.chargingState = props["battery::power-source"] === 2 ? 1 : 0;
      this.batteryService
        .getCharacteristic(Characteristic.ChargingState)
        .updateValue(this.chargingState);
    }

    if (props["device-info::firmware-ver"] !== undefined) {
      this.firmwareVersion = String(props["device-info::firmware-ver"]);
      this.homeKitAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareVersion);
    }

    // Persist for next reboot.
    this.persistState({
      isLocked: this.isLocked,
      isDoorOpen: this.isDoorOpen,
      batteryLevel: this.batteryLevel,
      chargingState: this.chargingState,
      firmwareVersion: this.firmwareVersion,
    });

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] ${this.display_name}: ${this.isLocked ? "locked" : "unlocked"}, ` +
          `door ${this.isDoorOpen ? "open" : "closed"}, battery ${this.batteryLevel}%`
      );

    return changed;
  }

  async getLockCurrentState() {
    return this.isLocked
      ? Characteristic.LockCurrentState.SECURED
      : Characteristic.LockCurrentState.UNSECURED;
  }

  async getLockTargetState() {
    return this.isLocked
      ? Characteristic.LockTargetState.SECURED
      : Characteristic.LockTargetState.UNSECURED;
  }

  async getDoorStatus() {
    return this.isDoorOpen
      ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  async getBatteryLevel() {
    return this.plugin.client.checkBatteryVoltage(this.batteryLevel);
  }

  async getLowBatteryStatus() {
    return this.plugin.client.checkLowBattery(this.batteryLevel);
  }

  async getChargingState() {
    return this.chargingState;
  }

  async setLockTargetState(targetState) {
    const isSecuring = targetState === Characteristic.LockTargetState.SECURED;
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Set "${this.display_name} (${this.mac})": ${isSecuring ? "lock" : "unlock"}`
      );

    // Optimistically update HomeKit immediately so the tile clears "waiting".
    // Grace period prevents the fast poll from reverting this before the API
    // propagates. Locking propagates in ~15s; unlocking takes ~90s on the
    // Wyze IoT3 endpoint.
    this.isLocked = isSecuring;
    this.armCommandGrace(isSecuring ? 15000 : 90000);
    this.lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(
      isSecuring ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED
    );
    this.lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(
      isSecuring ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED
    );

    const cmdT0 = Date.now();
    const call = isSecuring
      ? this.plugin.client.lockBoltV2Lock(this.mac, this.product_model)
      : this.plugin.client.lockBoltV2Unlock(this.mac, this.product_model);

    call
      .then((result) => {
        if (!result || result.code !== "1") {
          // IoT3 resolved without throwing but reported a logical failure —
          // don't leave HomeKit showing a command that never actually applied.
          this.clearCommandGrace();
          this.plugin.log.error(
            `[LockBoltV2] Command failed for "${this.display_name}": ${result?.msg ?? "no response"}`
          );
          return;
        }
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(`[LockBoltV2] Command ACK in ${Date.now() - cmdT0}ms for "${this.display_name}"`);
      })
      .catch((e) => {
        this.clearCommandGrace();
        this.plugin.log.error(
          `[LockBoltV2] Command error after ${Date.now() - cmdT0}ms for "${this.display_name}": ${e.message || e}`
        );
      });
  }
};
