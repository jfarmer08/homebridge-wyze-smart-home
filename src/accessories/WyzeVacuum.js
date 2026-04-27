const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

module.exports = class WyzeVacuum extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.suctionLevel = 2; // STANDARD
    this.batteryLevel = 100;
    this.isCharging = false;
    this.isCleaning = false;

    this.fanService =
      this.homeKitAccessory.getService(Service.Fan) ||
      this.homeKitAccessory.addService(Service.Fan);

    this.fanService
      .getCharacteristic(Characteristic.On)
      .onGet(this.getIsActive.bind(this))
      .onSet(this.setIsActive.bind(this));

    this.fanService
      .getCharacteristic(Characteristic.RotationSpeed)
      .onGet(this.getSuctionSpeed.bind(this))
      .onSet(this.setSuctionSpeed.bind(this))
      .setProps({ minStep: 33, minValue: 0, maxValue: 100 });

    this.batteryService =
      this.homeKitAccessory.getService(Service.Battery) ||
      this.homeKitAccessory.addService(Service.Battery);

    this.batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .onGet(() => this.batteryLevel);

    this.batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(() =>
        this.batteryLevel < 20
          ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );

    this.batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .onGet(() =>
        this.isCharging
          ? Characteristic.ChargingState.CHARGING
          : Characteristic.ChargingState.NOT_CHARGING
      );
  }

  async updateCharacteristics(device) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Vacuum] Updating "${this.display_name} (${this.mac})"`);

    try {
      const info = await this.plugin.client.getVacuumInfo(this.mac);
      if (!info) return;

      // `battary` is the Wyze API field name (typo in their API)
      const battery = info.battary ?? this.batteryLevel;
      const modeName = this.plugin.client.vacuumGetMode(info);
      const suction = info.cleanlevel ?? this.suctionLevel;
      const charging = !!(info.chargeState);

      this.batteryLevel = battery;
      this.suctionLevel = suction;
      this.isCharging = charging;
      this.isCleaning = modeName === "CLEANING" || modeName === "MAPPING";

      this.fanService.getCharacteristic(Characteristic.On).updateValue(this.isCleaning);
      this.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(this.suctionLevel * 33);

      this.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(battery);
      this.batteryService
        .getCharacteristic(Characteristic.StatusLowBattery)
        .updateValue(
          battery < 20
            ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
            : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
        );
      this.batteryService
        .getCharacteristic(Characteristic.ChargingState)
        .updateValue(
          charging
            ? Characteristic.ChargingState.CHARGING
            : Characteristic.ChargingState.NOT_CHARGING
        );
    } catch (e) {
      this.plugin.log.error(`[Vacuum] Error updating "${this.display_name}": ${e}`);
    }
  }

  async getIsActive() {
    return this.isCleaning;
  }

  async setIsActive(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Vacuum] Setting active for "${this.display_name}" to ${value}`);
    if (value) {
      await this.plugin.client.vacuumClean(this.mac);
    } else {
      await this.plugin.client.vacuumDock(this.mac);
    }
    this.isCleaning = !!value;
  }

  async getSuctionSpeed() {
    return this.suctionLevel * 33;
  }

  async setSuctionSpeed(value) {
    // HomeKit sends 0-100; map to Wyze suction level 1-3
    const level = value <= 33 ? 1 : value <= 66 ? 2 : 3;
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Vacuum] Setting suction for "${this.display_name}" to level ${level} (speed ${value})`
      );
    this.suctionLevel = level;
    await this.plugin.client.vacuumSetSuctionLevel(this.mac, this.product_model, level);
  }
};
