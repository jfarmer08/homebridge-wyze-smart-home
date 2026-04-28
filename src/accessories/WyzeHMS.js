const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

const TARGET = Characteristic.SecuritySystemTargetState;
const CURRENT = Characteristic.SecuritySystemCurrentState;

module.exports = class WyzeHMS extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.securityService = this.homeKitAccessory.getService(Service.SecuritySystem);
    if (!this.securityService) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[HMS] Adding service for "${this.display_name}"`);
      this.securityService = this.homeKitAccessory.addService(Service.SecuritySystem);
    }

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(this.handleStateGet.bind(this));
    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(this.handleStateGet.bind(this))
      .onSet(this.handleTargetStateSet.bind(this));
  }

  async updateCharacteristics(device) {
    // Security system is safety-critical — use StatusFault (⚠️ triangle)
    // so the user notices stale state without losing the last known mode.
    const online = device.conn_state !== 0;
    markServiceOnline(this.securityService, online, "fault");

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[HMS] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked with fault`
        );
      return;
    }

    // NOTE: HMS adds 1-2 extra API calls per refresh — getPlanBindingListByUser
    // (once, cached) and monitoringProfileStateStatus (every cycle).
    try {
      await this.getHmsID();
      const response = await this.plugin.client.monitoringProfileStateStatus(this.hmsId);
      this.hmsStatus = response.message;
      this.securityService
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .updateValue(this.convertHmsStateToHomeKitState(this.hmsStatus));
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[HMS] ${this.display_name}: ${this.hmsStatus}`);
    } catch (err) {
      this.plugin.log.error(
        `[HMS] Update failed for "${this.display_name}": ${err.message || err}`
      );
      markServiceOnline(this.securityService, false, "fault");
    }
  }

  async handleStateGet() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[HMS] Get "${this.display_name}": ${this.hmsStatus}`);
    if (!this.hmsStatus || this.hmsStatus === "undefined") return TARGET.DISARM;
    return this.convertHmsStateToHomeKitState(this.hmsStatus);
  }

  async handleTargetStateSet(value) {
    const wyzeState = this.convertHomeKitStateToHmsState(value);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[HMS] Set target "${this.display_name}": ${wyzeState}`);
    try {
      await this.plugin.client.setHMSState(this.hmsId, wyzeState);
    } catch (err) {
      this.plugin.log.error(
        `[HMS] Set failed for "${this.display_name}": ${err.message || err}`
      );
      throw err;
    }
  }

  convertHmsStateToHomeKitState(hmsState) {
    switch (hmsState) {
      case "home":     return TARGET.STAY_ARM;
      case "away":     return TARGET.AWAY_ARM;
      case "disarm":
      case "changing": return TARGET.DISARM;
      default:         return TARGET.DISARM;
    }
  }

  convertHomeKitStateToHmsState(homeKitState) {
    switch (homeKitState) {
      case TARGET.STAY_ARM:
      case TARGET.NIGHT_ARM:        return "home";
      case TARGET.AWAY_ARM:         return "away";
      case TARGET.DISARM:           return "off";
      case CURRENT.ALARM_TRIGGERED: return "";
      default:                      return "off";
    }
  }

  async getHmsID() {
    if (this.hmsId) return this.hmsId;
    const response = await this.plugin.client.getPlanBindingListByUser();
    this.hmsId = response.data[0].deviceList[0].device_id;
    return this.hmsId;
  }
};
