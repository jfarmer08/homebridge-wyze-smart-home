const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeHMS extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // create a new Security System service
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[HMS] Retrieving previous service for "${this.display_name}"`
      );
    this.securityService = this.homeKitAccessory.getService(
      Service.SecuritySystem
    );

    if (!this.securityService) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(`[HMS] Adding service for "${this.display_name}"`);
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
    if (device.conn_state === 0) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[HMS] Updating status ${this.mac} (${this.display_name}) to noResponse`
        );
      this.getCharacteristic(Characteristic.SecuritySystemCurrentState).updateValue(noResponse);
    } else {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
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
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[HMS] Getting Current State of "${this.display_name}" : "${this.hmsStatus}"`
      );
    if (this.hmsStatus === "undefined" || this.hmsStatus == null) {
      return 0;
    } else return this.convertHmsStateToHomeKitState(this.hmsStatus);
  }

  async handleSecuritySystemTargetStateGet() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[HMS] Getting Target State of "${this.display_name}" : "${this.hmsStatus}"`
      );
    if (this.hmsStatus === "undefined" || this.hmsStatus == null) {
      return 0;
    } else return this.convertHmsStateToHomeKitState(this.hmsStatus);
  }

  async handleSecuritySystemTargetStateSet(value) {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
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
