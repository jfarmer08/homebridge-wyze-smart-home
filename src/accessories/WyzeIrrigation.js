const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

const DEFAULT_DURATION_SECONDS = 600; // 10 minutes

module.exports = class WyzeIrrigation extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Zone number from plugin config; each MAC can have one zone configured.
    // config.irrigationZone: { [mac]: zoneNumber } — defaults to zone 1.
    this.zoneNumber = this.plugin.config.irrigationZone?.[this.mac] ?? 1;
    this.setDuration = DEFAULT_DURATION_SECONDS;
    this.remainingDuration = 0;
    this.isActive = false;
    this.isInUse = false;
    this._remainingTimer = null;

    this.valveService =
      this.homeKitAccessory.getService(Service.Valve) ||
      this.homeKitAccessory.addService(Service.Valve);

    this.valveService
      .getCharacteristic(Characteristic.ValveType)
      .onGet(() => Characteristic.ValveType.IRRIGATION);

    this.valveService
      .getCharacteristic(Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    this.valveService
      .getCharacteristic(Characteristic.InUse)
      .onGet(this.getInUse.bind(this));

    this.valveService
      .getCharacteristic(Characteristic.SetDuration)
      .onGet(this.getSetDuration.bind(this))
      .onSet(this.handleSetDuration.bind(this))
      .setProps({ minValue: 1, maxValue: 3600, minStep: 1 });

    this.valveService
      .getCharacteristic(Characteristic.RemainingDuration)
      .onGet(this.getRemainingDuration.bind(this));
  }

  async updateCharacteristics(device) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Irrigation] Updating "${this.display_name} (${this.mac})" zone ${this.zoneNumber}`
      );
    // Reflect connectivity via StatusActive instead of forcing Active/InUse
    // to 0, which would falsely look like the user stopped the run.
    markServiceOnline(this.valveService, device.conn_state !== 0);
    if (device.conn_state === 0 && this.plugin.config.pluginLoggingEnabled) {
      this.plugin.log(
        `[Irrigation] ${this.mac} zone ${this.zoneNumber} is offline — keeping last known state, marked inactive`
      );
    }
  }

  async getActive() {
    return this.isActive
      ? Characteristic.Active.ACTIVE
      : Characteristic.Active.INACTIVE;
  }

  async setActive(value) {
    const starting = value === Characteristic.Active.ACTIVE;
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Irrigation] ${starting ? "Starting" : "Stopping"} "${this.display_name}" zone ${this.zoneNumber}`
      );

    if (starting) {
      await this.plugin.client.irrigationQuickRun(this.mac, this.zoneNumber, this.setDuration);
      this.isActive = true;
      this.isInUse = true;
      this.remainingDuration = this.setDuration;
      this._startCountdown();
    } else {
      await this.plugin.client.irrigationStop(this.mac);
      this._clearCountdown();
      this.isActive = false;
      this.isInUse = false;
      this.remainingDuration = 0;
    }

    this.valveService
      .getCharacteristic(Characteristic.Active)
      .updateValue(this.isActive ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
    this.valveService
      .getCharacteristic(Characteristic.InUse)
      .updateValue(this.isInUse ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE);
    this.valveService
      .getCharacteristic(Characteristic.RemainingDuration)
      .updateValue(this.remainingDuration);
  }

  async getInUse() {
    return this.isInUse
      ? Characteristic.InUse.IN_USE
      : Characteristic.InUse.NOT_IN_USE;
  }

  async getSetDuration() {
    return this.setDuration;
  }

  async handleSetDuration(value) {
    this.setDuration = value;
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Irrigation] SetDuration for "${this.display_name}" zone ${this.zoneNumber}: ${value}s`
      );
  }

  async getRemainingDuration() {
    return this.remainingDuration;
  }

  _startCountdown() {
    this._clearCountdown();
    this._remainingTimer = setInterval(() => {
      this.remainingDuration = Math.max(0, this.remainingDuration - 1);
      this.valveService
        .getCharacteristic(Characteristic.RemainingDuration)
        .updateValue(this.remainingDuration);

      if (this.remainingDuration <= 0) {
        this._clearCountdown();
        this.isActive = false;
        this.isInUse = false;
        this.valveService
          .getCharacteristic(Characteristic.Active)
          .updateValue(Characteristic.Active.INACTIVE);
        this.valveService
          .getCharacteristic(Characteristic.InUse)
          .updateValue(Characteristic.InUse.NOT_IN_USE);
      }
    }, 1000);
  }

  _clearCountdown() {
    if (this._remainingTimer) {
      clearInterval(this._remainingTimer);
      this._remainingTimer = null;
    }
  }
};
