const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeHMS extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // create a new Security System service
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[HMS] Retrieving previous service for "${this.display_name}"`
      );
    this.securityService = this.homeKitAccessory.getService(
      Service.SecuritySystem
    );

    if (!this.securityService) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[HMS] Adding service for "${this.display_name}"`);
      this.securityService = this.homeKitAccessory.addService(
        Service.SecuritySystem
      );
    }

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
      .onSet(this.handleSecuritySystemTargetStateSet.bind(this));
  }

  async updateCharacteristics(device) {
    // Security system is safety-critical — use StatusFault (⚠️ triangle)
    // so the user notices stale state, but the last known armed mode
    // stays visible instead of an unreachable banner.
    markServiceOnline(this.securityService, device.conn_state !== 0, "fault");

    if (device.conn_state === 0) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[HMS] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked with fault`
        );
    } else {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[HMS] Updating Current State of "${this.display_name}"`
        );
      await this.getHmsID();
      const response = await this.plugin.client.monitoringProfileStateStatus(
        this.hmsId
      );
      this.hmsStatus = response.message;
      this.securityService
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .updateValue(this.convertHmsStateToHomeKitState(this.hmsStatus));
    }
  }

  async handleSecuritySystemCurrentStateGet() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[HMS] Getting Current State of "${this.display_name}" : "${this.hmsStatus}"`
      );
    if (this.hmsStatus === "undefined" || this.hmsStatus == null) {
      return 0;
    } else return this.convertHmsStateToHomeKitState(this.hmsStatus);
  }

  async handleSecuritySystemTargetStateGet() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[HMS] Getting Target State of "${this.display_name}" : "${this.hmsStatus}"`
      );
    if (this.hmsStatus === "undefined" || this.hmsStatus == null) {
      return 0;
    } else return this.convertHmsStateToHomeKitState(this.hmsStatus);
  }

  async handleSecuritySystemTargetStateSet(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[HMS] Target State Set "${
          this.display_name
        }" : "${this.convertHomeKitStateToHmsState(value)}"`
      );
    await this.plugin.client.setHMSState(
      this.hmsId,
      this.convertHomeKitStateToHmsState(value)
    );
  }

  convertHmsStateToHomeKitState(hmsState) {
    switch (hmsState) {
      case "changing":
        return Characteristic.SecuritySystemTargetState.DISARM;
      case "home":
        return Characteristic.SecuritySystemTargetState.STAY_ARM;
      case "away":
        return Characteristic.SecuritySystemTargetState.AWAY_ARM;
      case "disarm":
        return Characteristic.SecuritySystemTargetState.DISARM;
    }
  }
  convertHomeKitStateToHmsState(homeKitState) {
    switch (homeKitState) {
      case Characteristic.SecuritySystemTargetState.STAY_ARM:
      case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        return "home";
      case Characteristic.SecuritySystemTargetState.AWAY_ARM:
        return "away";
      case Characteristic.SecuritySystemTargetState.DISARM:
        return "off";
      case Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED:
        return "";
    }
  }

  async getHmsID() {
    if (this.hmsId == null || this.hmsId == "undefined") {
      const response = await this.plugin.client.getPlanBindingListByUser();
      this.hmsId = response.data[0].deviceList[0].device_id;
      return this.hmsId;
    } else return this.hmsId;
  }
};
