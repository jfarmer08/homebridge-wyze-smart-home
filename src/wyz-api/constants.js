const {
    v4: uuidv4
} = require('uuid');


module.exports = Object.freeze({
    // Crypto Secrets
    fordAppKey : '275965684684dbdaf29a0ed9', // Required for Locks
    fordAppSecret : '4deekof1ba311c5c33a9cb8e12787e8c', // Required for Locks
    oliveSigningSecret : 'wyze_app_secret_key_132', // Required for the thermostat
    oliveAppId : '9319141212m2ik', //  Required for the thermostat
    appInfo : 'wyze_android_2.19.14', // Required for the thermostat

    // App emulation constants
    phoneId : 'wyze_developer_api',
    appName : 'com.hualai.WyzeCam',
    appVer : 'wyze_developer_api',
    appVersion : 'wyze_developer_api',
    sc : 'wyze_developer_api',
    sv : 'wyze_developer_api',
    authApiKey : 'WMXHYf79Nr5gIlt3r0r7p9Tcw5bvs6BB4U8O8nGJ',
    userAgent : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',

    //URLs
    authBaseUrl: 'https://auth-prod.api.wyze.com',
    apiBaseUrl: 'https://api.wyzecam.com'
})