"use strict";

const { Characteristic } = require("../types");

/**
 * Mark a HomeKit Service as online or offline using the standard HAP
 * characteristics — quieter than throwing the `noResponse` Error, which
 * triggers HomeKit's red "unreachable" banner and hides cached state.
 *
 * Two modes:
 *   - "active" (default): uses `StatusActive` (boolean). Renders as a
 *     subtle "inactive" badge in the Home app. The user still sees the
 *     last known state and can interact with the tile. Best for
 *     non-safety devices: switches, sensors, lights, plugs, cameras.
 *   - "fault": uses `StatusFault` (NO_FAULT / GENERAL_FAULT). Renders as
 *     a ⚠️ triangle — louder, more attention-grabbing. Best for
 *     safety-critical devices where stale data could mislead the user
 *     into a bad decision: locks, thermostats, security systems.
 *
 * Both characteristics are *optional* on most services, so we add them
 * lazily the first time we need them.
 *
 * @param {Service} service — HAP Service to mark
 * @param {boolean} online — true = online (clear indicator), false = offline (set indicator)
 * @param {"active"|"fault"} [mode] — which characteristic to use
 */
function markServiceOnline(service, online, mode = "active") {
  if (!service) return;

  if (mode === "fault") {
    if (!service.testCharacteristic(Characteristic.StatusFault)) {
      service.addCharacteristic(Characteristic.StatusFault);
    }
    service
      .getCharacteristic(Characteristic.StatusFault)
      .updateValue(
        online
          ? Characteristic.StatusFault.NO_FAULT
          : Characteristic.StatusFault.GENERAL_FAULT
      );
    return;
  }

  // "active" mode — default
  if (!service.testCharacteristic(Characteristic.StatusActive)) {
    service.addCharacteristic(Characteristic.StatusActive);
  }
  service
    .getCharacteristic(Characteristic.StatusActive)
    .updateValue(Boolean(online));
}

module.exports = { markServiceOnline };
