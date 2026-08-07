const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeLock extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.lockService = this._getOrAddService(Service.LockMechanism, "LockMechanism");
    this.contactService = this._getOrAddService(Service.ContactSensor, "Door Contact");
    this.batteryService = this._getOrAddService(Service.Battery, "Battery");

    // Restore from disk so HomeKit shows real state immediately on
    // reboot — critical for a safety device. Otherwise the lock could
    // briefly show "unlocked" right after restart even though it's
    // actually locked.
    const persisted = this.loadPersistedState();
    this.hardlock = persisted.hardlock;
    this.door_open_status = persisted.door_open_status;
    this.lockPower = persisted.lockPower;
    this.lockOnOffline = persisted.lockOnOffline;
    this.trash_mode = persisted.trash_mode;

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
      return false;
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
      return false;
    }

    const lockProperties = propertyList?.device;
    if (!lockProperties) {
      this.plugin.log.error(`[Lock] getLockInfo returned no device data for ${this.display_name}`);
      return false;
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

    // Skip hardlock (locked/unlocked) during grace period after a command —
    // the Ford API lags a few seconds (unlock can take ~90s) before
    // reflecting the new state, which would otherwise revert the optimistic
    // update setLockTargetState already made. Push both Current AND Target
    // state so a physical/keypad change doesn't leave HomeKit stuck showing
    // "waiting" on the tile.
    const lockerStatus = lockProperties.locker_status || {};
    let changed = false;
    if (lockerStatus.hardlock !== undefined && !this.inCommandGrace()) {
      changed = this.hardlock !== lockerStatus.hardlock;
      this.hardlock = lockerStatus.hardlock;
      const lockState = this.plugin.client.getLockState(this.hardlock);
      this.lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(lockState);
      this.lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(lockState);
    }

    // Persist so the next reboot shows real state instead of undefined
    // until the first refresh completes.
    this.persistState({
      hardlock: this.hardlock,
      door_open_status: this.door_open_status,
      lockPower: this.lockPower,
      lockOnOffline: this.lockOnOffline,
      trash_mode: this.trash_mode,
    });

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Lock] ${this.display_name}: ${this.hardlock === 2 ? "unlocked" : "locked"}, ` +
          `door ${this.door_open_status === 1 ? "open" : "closed"}, battery ${this.lockPower}%`
      );

    return changed;
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

    // Optimistically update HomeKit immediately so the tile clears "waiting".
    // Grace period prevents the fast poll from reverting this before the API
    // propagates. Locking propagates in ~15s; unlocking takes ~90s on the
    // Wyze Ford API endpoint.
    this.hardlock = isSecuring ? 1 : 2;
    this.armCommandGrace(isSecuring ? 15000 : 90000);
    this.lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(
      isSecuring ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED
    );
    this.lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(
      isSecuring ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED
    );

    const cmdT0 = Date.now();
    this.plugin.client.controlLock(
      this.mac,
      this.product_model,
      isSecuring ? "remoteLock" : "remoteUnlock"
    )
      .then(() => {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(`[Lock] Command ACK in ${Date.now() - cmdT0}ms for "${this.display_name}"`);
      })
      .catch((e) => {
        // Command failed — don't leave the optimistic state stuck for the
        // full grace window; let the next poll correct it.
        this.clearCommandGrace();
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(`[Lock] Command error after ${Date.now() - cmdT0}ms for "${this.display_name}": ${e}`);
      });
  }
};
