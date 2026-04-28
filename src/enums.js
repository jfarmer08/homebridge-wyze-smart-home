/**
 * Per-accessory product-model lookups used by getAccessoryClass to route
 * a Wyze device to the right HomeKit accessory class.
 *
 * Source of truth lives in the wyze-api submodule
 * (`WyzeAccessoryModels`). This module shallow-clones each map so the
 * plugin can extend them at runtime via `applyConfigOverrides()` —
 * useful when Wyze releases a new product code that hasn't been added
 * to the upstream module yet, so users can route the new model to an
 * existing handler class for testing without waiting for a release.
 */

//const { WyzeAccessoryModels } = require('wyze-api') // Uncomment for Release
const { WyzeAccessoryModels } = require('./wyze-api/src') // Comment for Release

// Shallow clone every category so applyConfigOverrides can add entries
// without mutating the upstream frozen object.
const CameraModels             = { ...WyzeAccessoryModels.CameraModels }
const OutdoorPlugModels        = { ...WyzeAccessoryModels.OutdoorPlugModels }
const PlugModels               = { ...WyzeAccessoryModels.PlugModels }
const LightModels              = { ...WyzeAccessoryModels.LightModels }
const MeshLightModels          = { ...WyzeAccessoryModels.MeshLightModels }
const LightStripModels         = { ...WyzeAccessoryModels.LightStripModels }
const ContactSensorModels      = { ...WyzeAccessoryModels.ContactSensorModels }
const MotionSensorModels       = { ...WyzeAccessoryModels.MotionSensorModels }
const LockModels               = { ...WyzeAccessoryModels.LockModels }
const LockBoltV2Models         = { ...WyzeAccessoryModels.LockBoltV2Models }
const TemperatureHumidityModels = { ...WyzeAccessoryModels.TemperatureHumidityModels }
const LeakSensorModels         = { ...WyzeAccessoryModels.LeakSensorModels }
const CommonModels             = { ...WyzeAccessoryModels.CommonModels }
const S1GatewayModels          = { ...WyzeAccessoryModels.S1GatewayModels }
const ThermostatModels         = { ...WyzeAccessoryModels.ThermostatModels }
const ThermostatRoomSensor     = { ...WyzeAccessoryModels.ThermostatRoomSensor }
const VacuumModels             = { ...WyzeAccessoryModels.VacuumModels }
const IrrigationModels         = { ...WyzeAccessoryModels.IrrigationModels }

const _MAP_BY_NAME = {
  CameraModels,
  OutdoorPlugModels,
  PlugModels,
  LightModels,
  MeshLightModels,
  LightStripModels,
  ContactSensorModels,
  MotionSensorModels,
  LockModels,
  LockBoltV2Models,
  TemperatureHumidityModels,
  LeakSensorModels,
  CommonModels,
  S1GatewayModels,
  ThermostatModels,
  ThermostatRoomSensor,
  VacuumModels,
  IrrigationModels,
}

/**
 * Merge user-supplied product codes into the existing model maps so an
 * unsupported device can be routed to an existing accessory class for
 * testing. Idempotent — safe to call multiple times.
 *
 * Two accepted shapes per category:
 *
 *   "deviceTypeOverrides": {
 *     "CameraModels": ["NEW_MODEL_1", "NEW_MODEL_2"],
 *     "ContactSensorModels": { "MyNewSensor": "DWS9X" }
 *   }
 *
 * Array entries get auto-keyed; object entries keep the user-chosen
 * friendly name. The friendly name is purely cosmetic — the matcher
 * only looks at values.
 *
 * Unknown category names are ignored with a warning so a typo doesn't
 * kill startup. Existing model codes aren't overwritten.
 *
 * @param {Object} [overrides] — config.deviceTypeOverrides
 * @param {Function} [log] — optional logger (defaults to console.warn)
 * @returns {{added: number, skipped: number, unknownCategories: string[]}}
 */
function applyConfigOverrides(overrides, log) {
  const result = { added: 0, skipped: 0, unknownCategories: [] }
  if (!overrides || typeof overrides !== 'object') return result
  const warn = (msg) => {
    if (log?.warn) return log.warn(msg)
    if (typeof log === 'function') return log(msg)
    return console.warn(msg)
  }

  for (const [category, extras] of Object.entries(overrides)) {
    const target = _MAP_BY_NAME[category]
    if (!target) {
      result.unknownCategories.push(category)
      warn(`[enums] Unknown deviceTypeOverrides category "${category}" — ignored. ` +
           `Valid categories: ${Object.keys(_MAP_BY_NAME).join(', ')}`)
      continue
    }

    const codes = Array.isArray(extras)
      ? Object.fromEntries(extras.map((c, i) => [`Override${i}`, String(c)]))
      : (extras && typeof extras === 'object' ? extras : null)

    if (!codes) {
      warn(`[enums] deviceTypeOverrides["${category}"] must be an array or object — ignored.`)
      continue
    }

    for (const [name, code] of Object.entries(codes)) {
      if (Object.values(target).includes(code)) {
        result.skipped++
        continue
      }
      target[name] = String(code)
      result.added++
    }
  }
  return result
}

exports.CameraModels = CameraModels
exports.OutdoorPlugModels = OutdoorPlugModels
exports.PlugModels = PlugModels
exports.LightModels = LightModels
exports.MeshLightModels = MeshLightModels
exports.LightStripModels = LightStripModels
exports.ContactSensorModels = ContactSensorModels
exports.MotionSensorModels = MotionSensorModels
exports.LockModels = LockModels
exports.LockBoltV2Models = LockBoltV2Models
exports.TemperatureHumidityModels = TemperatureHumidityModels
exports.LeakSensorModels = LeakSensorModels
exports.CommonModels = CommonModels
exports.S1GatewayModels = S1GatewayModels
exports.ThermostatModels = ThermostatModels
exports.ThermostatRoomSensor = ThermostatRoomSensor
exports.VacuumModels = VacuumModels
exports.IrrigationModels = IrrigationModels
exports.applyConfigOverrides = applyConfigOverrides
