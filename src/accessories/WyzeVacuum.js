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

    // Per-room sweep switches. roomSwitchesEnabled is a boolean opt-in
    // because a vacuum with 10+ rooms creates 10+ extra HomeKit tiles —
    // some users want that for "Hey Siri, vacuum kitchen", others would
    // find it noisy. Honors per-vacuum config, falls back to global.
    this.roomSwitchesEnabled =
      this.plugin?.config?.vacuum?.perRoomSwitches === true;
    this.roomServices = new Map(); // roomId → Service instance
    this.lastSweepRoomId = persisted.lastSweepRoomId ?? null;
    this._roomsLoaded = false;
  }

  /**
   * Lazy room discovery — runs once on the first updateCharacteristics()
   * call (constructors can't await). Pulls the current map's room list
   * via getVacuumRooms() and adds one Switch service per room with a
   * stable subtype `vacuum-room-${id}` so HomeKit treats it as the same
   * accessory across restarts.
   *
   * If the room list changes (rooms added/removed in the Wyze app),
   * we add new services and leave stale ones to be unregistered on the
   * next homebridge restart — homebridge tolerates extra services more
   * gracefully than mid-update removal.
   */
  async _ensureRoomServices() {
    if (this._roomsLoaded || !this.roomSwitchesEnabled) return;
    this._roomsLoaded = true; // set early so a failure doesn't retry every refresh
    let rooms = [];
    try {
      rooms = await this.plugin.client.getVacuumRooms(this.mac);
    } catch (e) {
      this.plugin.log.warn?.(
        `[Vacuum] Could not load room list for "${this.display_name}": ${e.message || e}. ` +
        `Per-room switches will not be available until the next restart.`
      );
      return;
    }
    if (rooms.length === 0) {
      this.plugin.log.info?.(
        `[Vacuum] "${this.display_name}" has no rooms in its current map. ` +
        `Per-room switches skipped until a map exists.`
      );
      return;
    }
    for (const room of rooms) {
      const subtype = `vacuum-room-${room.id}`;
      const displayName = `${this.display_name}: ${room.name}`;
      let service =
        this.homeKitAccessory.getServiceById(Service.Switch, subtype) ||
        this.homeKitAccessory.addService(Service.Switch, displayName, subtype);
      // Keep the display name in sync if the user renamed the room in
      // the Wyze app since last boot.
      service.setCharacteristic(Characteristic.Name, displayName);
      service
        .getCharacteristic(Characteristic.On)
        .onGet(() => this._isSweepingRoom(room.id))
        .onSet((value) => this._setRoomSweep(room.id, room.name, !!value));
      this.roomServices.set(room.id, service);
    }
    if (this.plugin.config.pluginLoggingEnabled) {
      this.plugin.log(
        `[Vacuum] "${this.display_name}": exposed ${rooms.length} per-room switch(es) ` +
        `(map "${rooms[0].mapName || rooms[0].mapId}")`
      );
    }
  }

  _isSweepingRoom(roomId) {
    return this.isCleaning && this.lastSweepRoomId === roomId;
  }

  async _setRoomSweep(roomId, roomName, on) {
    if (on) {
      // Refuse if the vacuum is mid-sweep on a different room. HomeKit
      // sees the switch flick back off; matches RMCob's behavior.
      if (this.isCleaning && this.lastSweepRoomId && this.lastSweepRoomId !== roomId) {
        this.plugin.log.warn?.(
          `[Vacuum] "${this.display_name}": refusing room "${roomName}" — already sweeping a different room`
        );
        const svc = this.roomServices.get(roomId);
        if (svc) setImmediate(() => svc.getCharacteristic(Characteristic.On).updateValue(false));
        return;
      }
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Vacuum] "${this.display_name}": sweeping room "${roomName}" (id ${roomId})`);
      try {
        await this.plugin.client.vacuumSweepRooms(this.mac, [roomId]);
        this.isCleaning = true;
        this.lastSweepRoomId = roomId;
        this.persistState({
          suctionLevel: this.suctionLevel,
          batteryLevel: this.batteryLevel,
          isCharging: this.isCharging,
          isCleaning: this.isCleaning,
          lastSweepRoomId: this.lastSweepRoomId,
        });
      } catch (e) {
        this.plugin.log.error(
          `[Vacuum] Sweep room "${roomName}" failed: ${e.message || e}`
        );
        const svc = this.roomServices.get(roomId);
        if (svc) setImmediate(() => svc.getCharacteristic(Characteristic.On).updateValue(false));
        throw e;
      }
    } else {
      // Toggle off → return to dock. Same semantics as flipping the
      // main Fan service off mid-sweep.
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Vacuum] "${this.display_name}": docking from room "${roomName}"`);
      try {
        await this.plugin.client.vacuumDock(this.mac);
        this.isCleaning = false;
        this.lastSweepRoomId = null;
      } catch (e) {
        this.plugin.log.error(`[Vacuum] Dock failed: ${e.message || e}`);
        throw e;
      }
    }
  }

  async updateCharacteristics(device) {
    // First-call: discover rooms and add per-room switches. Done here
    // (not in the constructor) because it needs an async API call.
    await this._ensureRoomServices();

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
    // Fault: e.g. 514 = "Wheels stuck". When present, Wyze reports
    // mode=PAUSED (or similar) which makes the vacuum look intentionally
    // idle. The fault tells the real story — surface it on the Fan
    // service via StatusFault so the Home app shows the warning
    // triangle, and log loudly so it's visible without needing debug.
    const fault = this.plugin.client.vacuumGetFault(info);

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

    // If the vacuum stopped, clear the "last room being swept" so the
    // per-room switch icons turn off once the sweep finishes.
    if (!this.isCleaning) this.lastSweepRoomId = null;
    for (const [roomId, svc] of this.roomServices) {
      svc.getCharacteristic(Characteristic.On).updateValue(this._isSweepingRoom(roomId));
    }

    this.persistState({
      suctionLevel: this.suctionLevel,
      batteryLevel: this.batteryLevel,
      isCharging: this.isCharging,
      isCleaning: this.isCleaning,
      lastSweepRoomId: this.lastSweepRoomId,
    });

    // Show the warning triangle in HomeKit when faulted, the active
    // dot when clear. markServiceOnline already handled the
    // online-from-list case above; this layers the fault check on top.
    if (!this.fanService.testCharacteristic(Characteristic.StatusFault)) {
      this.fanService.addCharacteristic(Characteristic.StatusFault);
    }
    this.fanService
      .getCharacteristic(Characteristic.StatusFault)
      .updateValue(
        fault
          ? Characteristic.StatusFault.GENERAL_FAULT
          : Characteristic.StatusFault.NO_FAULT
      );

    if (fault) {
      // Warn-level so users see it without enabling debug. Repeat-suppress
      // so the log doesn't fill up while the vacuum is stuck — only print
      // when the code changes (cleared, or shifted to a different fault).
      if (this._lastReportedFaultCode !== fault.code) {
        this._lastReportedFaultCode = fault.code;
        const desc = fault.description || `unknown fault code ${fault.code}`;
        this.plugin.log.warn?.(
          `[Vacuum] "${this.display_name}": FAULT ${fault.code} — ${desc}. ` +
          `Wyze reports the vacuum as ${modeName.toLowerCase()}; check the Wyze app for the full message.`
        );
      }
    } else if (this._lastReportedFaultCode != null) {
      this._lastReportedFaultCode = null;
      this.plugin.log.info?.(`[Vacuum] "${this.display_name}": fault cleared`);
    }

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Vacuum] ${this.mac} (${this.display_name}): ${modeName.toLowerCase()}` +
          (fault ? ` (FAULT ${fault.code}: ${fault.description || "unknown"})` : "") +
          `, suction L${suction}, battery ${battery}%${charging ? " ⚡" : ""}`
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
