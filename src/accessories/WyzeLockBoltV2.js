const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeLockBoltV2 extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.isLocked = true;
    this.isDoorOpen = false;
    this.batteryLevel = 100;

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    this.lockService = this.homeKitAccessory.getService(Service.LockMechanism);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] [Door Contact] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    this.contactService = this.homeKitAccessory.getService(Service.ContactSensor);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] [Battery] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    this.batteryService = this.homeKitAccessory.getService(Service.Battery);

    if (!this.lockService) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] Adding service for "${this.display_name} (${this.mac})"`
        );
      this.lockService = this.homeKitAccessory.addService(Service.LockMechanism);
    }

    if (!this.contactService) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] [Door Contact] Adding service for "${this.display_name} (${this.mac})"`
        );
      this.contactService = this.homeKitAccessory.addService(Service.ContactSensor);
    }

    if (!this.batteryService) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] [Battery] Adding service for "${this.display_name} (${this.mac})"`
        );
      this.batteryService = this.homeKitAccessory.addService(Service.Battery);
    }

    this.batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));

    this.batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(this.getLowBatteryStatus.bind(this));

    this.contactService
      .getCharacteristic(Characteristic.ContactSensorState)
      .onGet(this.getDoorStatus.bind(this));

    this.lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .onGet(this.getLockCurrentState.bind(this));

    this.lockService
      .getCharacteristic(Characteristic.LockTargetState)
      .onGet(this.getLockTargetState.bind(this))
      .onSet(this.setLockTargetState.bind(this));
  }

  async updateCharacteristics(device) {
    if (device.conn_state === 0) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] Updating status "${this.display_name} (${this.mac}) to noResponse"`
        );
      this.lockService
        .getCharacteristic(Characteristic.LockCurrentState)
        .updateValue(noResponse);
      return;
    }

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Updating status of "${this.display_name} (${this.mac})"`
      );

    try {
      const result = await this.plugin.client.lockBoltV2GetProperties(
        this.mac,
        this.product_model
      );
      if (result.code !== "1") {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[LockBoltV2] IoT3 error for "${this.display_name} (${this.mac})": ${result.msg}`
          );
        return;
      }

      const props = (result.data && result.data.props) || {};

      if (props["lock::lock-status"] !== undefined) {
        this.isLocked = props["lock::lock-status"];
        this.lockService
          .getCharacteristic(Characteristic.LockCurrentState)
          .updateValue(
            this.isLocked
              ? Characteristic.LockCurrentState.SECURED
              : Characteristic.LockCurrentState.UNSECURED
          );
        this.lockService
          .getCharacteristic(Characteristic.LockTargetState)
          .updateValue(
            this.isLocked
              ? Characteristic.LockTargetState.SECURED
              : Characteristic.LockTargetState.UNSECURED
          );
      }

      if (props["lock::door-status"] !== undefined) {
        // door-status: true = door closed, false = door open
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
    } catch (e) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] Error updating "${this.display_name} (${this.mac})": ${e}`
        );
    }
  }

  async getLockCurrentState() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Getting Current State "${this.display_name} (${this.mac}) to ${this.isLocked}"`
      );
    return this.isLocked
      ? Characteristic.LockCurrentState.SECURED
      : Characteristic.LockCurrentState.UNSECURED;
  }

  async getLockTargetState() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Getting Target State "${this.display_name} (${this.mac}) to ${this.isLocked}"`
      );
    return this.isLocked
      ? Characteristic.LockTargetState.SECURED
      : Characteristic.LockTargetState.UNSECURED;
  }

  async getDoorStatus() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Getting Door Status "${this.display_name} (${this.mac}) to ${this.isDoorOpen}"`
      );
    return this.isDoorOpen
      ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  async getBatteryLevel() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Getting Battery Level "${this.display_name} (${this.mac}) to ${this.batteryLevel}"`
      );
    return this.plugin.client.checkBatteryVoltage(this.batteryLevel);
  }

  async getLowBatteryStatus() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Getting Low Battery Status "${this.display_name} (${this.mac}) to ${this.plugin.client.checkLowBattery(this.batteryLevel)}"`
      );
    return this.plugin.client.checkLowBattery(this.batteryLevel);
  }

  async setLockTargetState(targetState) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LockBoltV2] Setting Target State "${this.display_name} (${this.mac}) to ${targetState}"`
      );

    try {
      const isSecuring = targetState === Characteristic.LockTargetState.SECURED;
      const result = isSecuring
        ? await this.plugin.client.lockBoltV2Lock(this.mac, this.product_model)
        : await this.plugin.client.lockBoltV2Unlock(this.mac, this.product_model);

      if (result.code !== "1") {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[LockBoltV2] Command failed for "${this.display_name} (${this.mac})": ${result.msg}`
          );
        return;
      }
      this.isLocked = isSecuring;
      this.lockService.setCharacteristic(
        Characteristic.LockCurrentState,
        this.isLocked
          ? Characteristic.LockCurrentState.SECURED
          : Characteristic.LockCurrentState.UNSECURED
      );
    } catch (e) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LockBoltV2] Error setting lock "${this.display_name} (${this.mac})": ${e}`
        );
    }
  }
};
