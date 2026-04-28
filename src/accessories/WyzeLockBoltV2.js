const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeLockBoltV2 extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.isLocked = true;
    this.isDoorOpen = false;
    this.batteryLevel = 100;

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
      .onGet(() => Characteristic.ChargingState.NOT_CHARGING);
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
      return;
    }

    // NOTE: one extra IoT3 call per refresh (lockBoltV2GetProperties) on
    // top of the bulk getObjectList. Bulk list doesn't include lock state.
    let result;
    try {
      result = await this.plugin.client.lockBoltV2GetProperties(this.mac, this.product_model);
    } catch (e) {
      this.plugin.log.error(
        `[LockBoltV2] Update failed for "${this.display_name}": ${e.message || e}`
      );
      markServiceOnline(this.lockService, false, "fault");
      return;
    }

    if (result?.code !== "1") {
      this.plugin.log.warn?.(
        `[LockBoltV2] IoT3 returned code ${result?.code} for "${this.display_name}": ${result?.msg}`
      );
      return;
    }

    const props = result.data?.props || {};

    if (props["lock::lock-status"] !== undefined) {
      this.isLocked = !!props["lock::lock-status"];
      this.lockService
        .getCharacteristic(Characteristic.LockCurrentState)
        .updateValue(this.isLocked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
      this.lockService
        .getCharacteristic(Characteristic.LockTargetState)
        .updateValue(this.isLocked ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);
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

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] ${this.display_name}: ${this.isLocked ? "locked" : "unlocked"}, ` +
          `door ${this.isDoorOpen ? "open" : "closed"}, battery ${this.batteryLevel}%`
      );
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

  async setLockTargetState(targetState) {
    const isSecuring = targetState === Characteristic.LockTargetState.SECURED;
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Set "${this.display_name} (${this.mac})": ${isSecuring ? "lock" : "unlock"}`
      );

    try {
      const result = isSecuring
        ? await this.plugin.client.lockBoltV2Lock(this.mac, this.product_model)
        : await this.plugin.client.lockBoltV2Unlock(this.mac, this.product_model);

      if (result?.code !== "1") {
        const msg = `IoT3 returned code ${result?.code}: ${result?.msg}`;
        this.plugin.log.error(`[LockBoltV2] Set failed for "${this.display_name}": ${msg}`);
        throw new Error(msg);
      }

      this.isLocked = isSecuring;
      this.lockService.setCharacteristic(
        Characteristic.LockCurrentState,
        isSecuring ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED
      );
    } catch (e) {
      this.plugin.log.error(
        `[LockBoltV2] Set failed for "${this.display_name}": ${e.message || e}`
      );
      throw e;
    }
  }
};
