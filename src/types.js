const types = {}

module.exports = types

module.exports.update = function (homebridge) {
  types.homebridge = homebridge
  types.Accessory = homebridge.platformAccessory
  types.Service = homebridge.hap.Service
  types.Characteristic = homebridge.hap.Characteristic
  types.UUIDGen = homebridge.hap.uuid
}
