const types = require('./types')

// Boot the plugin
module.exports = function (homebridge) {
  types.update(homebridge)

  require('./WyzeSmartHome').register()
}
