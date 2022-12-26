const {
    v4: uuidv4
} = require('uuid');


module.exports = Object.freeze({
    // Crypto Secrets
    fordAppKey : '275965684684dbdaf29a0ed9', // Required for Locks
    fordAppSecret : '4deekof1ba311c5c33a9cb8e12787e8c', // Required for Locks
    oliveSigningSecret : 'wyze_app_secret_key_132', // Required for the thermostat
    oliveAppId : '9319141212m2ik', //  Required for the thermostat

    // App emulation constants
    phoneId : uuidv4(),
    appName : 'com.hualai.WyzeCam',
    appVer : 'com.hualai.WyzeCam___2.18.44',
    appVersion : '2.18.44',
    appInfo : 'wyze_android_2.19.14', // Required for the thermostat
    sc : '9f275790cab94a72bd206c8876429f3c',
    sv : '9d74946e652647e9b6c9d59326aef104',
    authApiKey : 'WMXHYf79Nr5gIlt3r0r7p9Tcw5bvs6BB4U8O8nGJ',
    userAgent : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',
})