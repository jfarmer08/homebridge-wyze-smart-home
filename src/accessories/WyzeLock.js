const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeLock extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

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
      .onGet(this.getBatteryStatus.bind(this));
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
        this.plugin.log(`[Lock] [${label}] Adding service for "${this.display_name} (${this.mac})"`);
      service = this.homeKitAccessory.addService(ServiceType);
    }
    return service;
  }

  async updateCharacteristics(device) {
    // Lock is safety-critical — use StatusFault (⚠️) on the lock service
    // so the user notices stale data without losing the last known state.
    const online = device.conn_state !== 0;
    markServiceOnline(this.lockService, online, "fault");

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Lock] "${this.display_name} (${this.mac})" is offline — keeping last known state, marked with fault`
        );
      return;
    }

    // NOTE: one extra Ford-API call per refresh (getLockInfo) on top of
    // the bulk getObjectList. Lock state isn't in the bulk list.
    let propertyList;
    try {
      propertyList = await this.plugin.client.getLockInfo(this.mac, this.product_model);
    } catch (err) {
      this.plugin.log.error(
        `[Lock] getLockInfo failed for "${this.display_name}": ${err.message || err}`
      );
      markServiceOnline(this.lockService, false, "fault");
      return;
    }

    const lockProperties = propertyList?.device;
    if (!lockProperties) {
      this.plugin.log.error(`[Lock] getLockInfo returned no device data for ${this.display_name}`);
      return;
    }

    if (lockProperties.onoff_line !== undefined) {
      this.lockOnOffline = lockProperties.onoff_line;
    }
    if (lockProperties.power !== undefined) {
      this.lockPower = lockProperties.power;
      this.batteryService
        .getCharacteristic(Characteristic.BatteryLevel)
        .updateValue(this.plugin.client.checkBatteryVoltage(this.lockPower));
      this.batteryService
        .getCharacteristic(Characteristic.StatusLowBattery)
        .updateValue(this.plugin.client.checkLowBattery(this.lockPower));
    }
    if (lockProperties.door_open_status !== undefined) {
      this.door_open_status = lockProperties.door_open_status;
      // BUG FIX: door state belongs on contactService (not lockService).
      // Writing it to lockService caused HomeKit to warn:
      // "Characteristic 'Contact Sensor State' not in required or optional
      //  characteristic section for service LockMechanism. Adding anyway."
      this.contactService
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue(this.plugin.client.getLockDoorState(this.door_open_status));
    }
    if (lockProperties.trash_mode !== undefined) {
      this.trash_mode = lockProperties.trash_mode;
    }

    const lockerStatus = lockProperties.locker_status || {};
    if (lockerStatus.hardlock !== undefined) {
      this.hardlock = lockerStatus.hardlock;
      this.lockService
        .getCharacteristic(Characteristic.LockCurrentState)
        .updateValue(this.plugin.client.getLockState(this.hardlock));
    }

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Lock] ${this.display_name}: ${this.hardlock === 2 ? "unlocked" : "locked"}, ` +
          `door ${this.door_open_status === 1 ? "open" : "closed"}, battery ${this.lockPower}%`
      );
  }

  async getLockCurrentState() {
    return this.hardlock === 2
      ? Characteristic.LockCurrentState.UNSECURED
      : Characteristic.LockCurrentState.SECURED;
  }

  async getLockTargetState() {
    return this.hardlock === 2
      ? Characteristic.LockTargetState.UNSECURED
      : Characteristic.LockTargetState.SECURED;
  }

  async getDoorStatus() {
    return this.door_open_status === 1
      ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  async getBatteryStatus() {
    return this.plugin.client.checkBatteryVoltage(this.lockPower);
  }

  async getLowBatteryStatus() {
    return this.plugin.client.checkLowBattery(this.lockPower);
  }

  async setLockTargetState(targetState) {
    const isSecuring = targetState === Characteristic.LockTargetState.SECURED;
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Lock] Set "${this.display_name}": ${isSecuring ? "lock" : "unlock"}`
      );
    try {
      await this.plugin.client.controlLock(
        this.mac,
        this.product_model,
        isSecuring ? "remoteLock" : "remoteUnlock"
      );
    } catch (err) {
      this.plugin.log.error(
        `[Lock] Set failed for "${this.display_name}": ${err.message || err}`
      );
      throw err;
    }

    // The Ford API doesn't immediately reflect the new state in subsequent
    // getLockInfo calls — there's a few-second lag. Optimistically update
    // CurrentState so HomeKit shows the new state right away. The next
    // refresh-cycle getLockInfo will overwrite if the lock didn't actually
    // honor the command (e.g. battery dead, mechanical jam).
    this.lockService.setCharacteristic(
      Characteristic.LockCurrentState,
      isSecuring ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED
    );
  }
};
