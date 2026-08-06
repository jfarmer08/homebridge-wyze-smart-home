const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeHMS extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.securityService = this.homeKitAccessory.getService(Service.SecuritySystem);
    if (!this.securityService) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[HMS] Adding service for "${this.display_name}"`);
      this.securityService = this.homeKitAccessory.addService(Service.SecuritySystem);
    }

    // Restore last-known state from disk so the Get handler returns the
    // real arm mode immediately on reboot instead of "(unknown — awaiting
    // first refresh)" while we wait for the first state-status fetch.
    const persisted = this.loadPersistedState();
    this.hmsStatus = persisted.hmsStatus;
    this.hmsId = persisted.hmsId; // saves an API call to re-resolve

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
      // Skip during grace period after a command — the API can report a
      // transient "changing" status while the real arm/disarm propagates,
      // which would otherwise revert the optimistic update we just made.
      if (!this.inCommandGrace()) {
        this.hmsStatus = response.message;
        this.securityService
          .getCharacteristic(Characteristic.SecuritySystemCurrentState)
          .updateValue(this.plugin.client.wyzeHmsStateToHomeKit(this.hmsStatus));
        // Persist so HomeKit gets the right value immediately after a reboot.
        this.persistState({ hmsStatus: this.hmsStatus, hmsId: this.hmsId });
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(`[HMS] ${this.display_name}: ${this.hmsStatus}`);
      }
    } catch (err) {
      this.plugin.log.error(
        `[HMS] Update failed for "${this.display_name}": ${err.message || err}`
      );
      markServiceOnline(this.securityService, false, "fault");
    }
  }

  async handleStateGet() {
    // No log here on purpose — HomeKit calls onGet repeatedly per
    // characteristic (every iOS client + hub independently polls), so
    // logging would spam several lines per second. State changes are
    // already logged in updateCharacteristics each refresh.
    return this.plugin.client.wyzeHmsStateToHomeKit(this.hmsStatus);
  }

  async handleTargetStateSet(value) {
    const wyzeState = this.plugin.client.homeKitHmsStateToWyze(value);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[HMS] Set target "${this.display_name}": ${wyzeState}`);

    // Optimistic update so the panel clears immediately. Grace period
    // prevents the next full refresh from reverting this before the API
    // propagates (or from re-showing a stale "changing" status).
    this.hmsStatus = wyzeState === "off" ? "disarm" : wyzeState;
    this.armCommandGrace(15000);
    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .updateValue(this.plugin.client.wyzeHmsStateToHomeKit(this.hmsStatus));

    this.getHmsID()
      .then(() => this.plugin.client.setHMSState(this.hmsId, wyzeState))
      .catch((err) => {
        // Command never went through — let the next full refresh correct
        // the optimistic state instead of holding it for the full grace window.
        this.clearCommandGrace();
        this.plugin.log.error(
          `[HMS] Set failed for "${this.display_name}": ${err.message || err}`
        );
      });
  }

  async getHmsID() {
    if (this.hmsId) return this.hmsId;
    const response = await this.plugin.client.getPlanBindingListByUser();
    const plans = Array.isArray(response?.data) ? response.data : [];

    // Wyze returns a list of plans (sometimes multiple — e.g. an expired
    // Annual Plan plus an active one). Find the first plan that actually
    // has a device bound to it instead of indexing [0] blindly.
    let foundPlan = null;
    let foundDevice = null;
    for (const plan of plans) {
      const dev = Array.isArray(plan?.deviceList) ? plan.deviceList[0] : null;
      if (dev?.device_id) {
        foundPlan = plan;
        foundDevice = dev;
        break;
      }
    }

    if (!foundDevice) {
      throw new Error(
        `[HMS] No HMS device found in plan list. Got ${plans.length} plan(s); ` +
        `none had a non-empty deviceList. Is your HMS subscription active?`
      );
    }

    if (foundPlan.service_status && foundPlan.service_status !== "ACTIVE") {
      this.plugin.log.warn?.(
        `[HMS] HMS subscription for "${this.display_name}" is ${foundPlan.service_status}. ` +
        `State queries may fail until the subscription is renewed.`
      );
    }

    this.hmsId = foundDevice.device_id;
    return this.hmsId;
  }
};
