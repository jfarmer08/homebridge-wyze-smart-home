const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeVacuum extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Restore from disk so the Get handlers return real values on
    // reboot instead of the static defaults below.
    const persisted = this.loadPersistedState();
    this.suctionLevel = persisted.suctionLevel ?? 2; // 2 = STANDARD
    this.batteryLevel = persisted.batteryLevel ?? 100;
    this.isCharging = persisted.isCharging ?? false;
    this.isCleaning = persisted.isCleaning ?? false;

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
    // Reflect bulk-list connectivity on the fan service. The detailed
    // getVacuumInfo call below will mark inactive too if it fails.
    const onlineFromList = device.conn_state !== 0;
    markServiceOnline(this.fanService, onlineFromList);
    if (!onlineFromList) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Vacuum] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }

    // NOTE: one extra getVacuumInfo API call per refresh — the bulk
    // getObjectList doesn't include vacuum mode / battery / charge state.
    let info;
    try {
      info = await this.plugin.client.getVacuumInfo(this.mac);
    } catch (e) {
      this.plugin.log.error(
        `[Vacuum] getVacuumInfo failed for "${this.display_name}": ${e.message || e}`
      );
      markServiceOnline(this.fanService, false);
      return;
    }
    if (!info) {
      markServiceOnline(this.fanService, false);
      return;
    }

    // `battary` is the Wyze API field name (typo in their API).
    const battery = info.battary ?? this.batteryLevel;
    const modeName = this.plugin.client.vacuumGetMode(info);
    const suction = info.cleanlevel ?? this.suctionLevel;
    const charging = !!info.chargeState;

    this.batteryLevel = battery;
    this.suctionLevel = suction;
    this.isCharging = charging;
    this.isCleaning = this.plugin.client.wyzeVacuumModeIsCleaning(modeName);

    this.fanService.getCharacteristic(Characteristic.On).updateValue(this.isCleaning);
    this.fanService
      .getCharacteristic(Characteristic.RotationSpeed)
      .updateValue(this.plugin.client.wyzeVacuumSuctionToHomeKit(this.suctionLevel));
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

    this.persistState({
      suctionLevel: this.suctionLevel,
      batteryLevel: this.batteryLevel,
      isCharging: this.isCharging,
      isCleaning: this.isCleaning,
    });

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Vacuum] ${this.mac} (${this.display_name}): ${modeName.toLowerCase()}, ` +
          `suction L${suction}, battery ${battery}%${charging ? " ⚡" : ""}`
      );
  }

  async getIsActive() {
    return this.isCleaning;
  }

  async setIsActive(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Vacuum] ${value ? "Cleaning" : "Docking"} "${this.display_name}"`);
    try {
      if (value) await this.plugin.client.vacuumClean(this.mac);
      else await this.plugin.client.vacuumDock(this.mac);
      this.isCleaning = !!value;
    } catch (e) {
      this.plugin.log.error(
        `[Vacuum] ${value ? "Clean" : "Dock"} failed for "${this.display_name}": ${e.message || e}`
      );
      throw e;
    }
  }

  async getSuctionSpeed() {
    return this.plugin.client.wyzeVacuumSuctionToHomeKit(this.suctionLevel);
  }

  async setSuctionSpeed(value) {
    const level = this.plugin.client.homeKitRotationSpeedToWyzeSuction(value);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Vacuum] Setting suction for "${this.display_name}" to level ${level} (HomeKit speed ${value})`
      );
    try {
      await this.plugin.client.vacuumSetSuctionLevel(this.mac, this.product_model, level);
      this.suctionLevel = level;
    } catch (e) {
      this.plugin.log.error(
        `[Vacuum] Suction set failed for "${this.display_name}": ${e.message || e}`
      );
      throw e;
    }
  }
};
