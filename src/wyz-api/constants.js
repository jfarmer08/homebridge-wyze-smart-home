const {
    v4: uuidv4
} = require('uuid');


module.exports = Object.freeze({
    // Crypto Secrets
    fordAppKey : '275965684684dbdaf29a0ed9', // Required for Locks
    fordAppSecret : '4deekof1ba311c5c33a9cb8e12787e8c', // Required for Locks
    oliveSigningSecret : 'wyze_app_secret_key_132', // Required for the thermostat
    oliveAppId : '9319141212m2ik' //  Required for the thermostat
})
    // App emulation constants
    PHONEID = uuidv4()
    APPNAME = 'com.hualai.WyzeCam'
    APPVER = 'com.hualai.WyzeCam___2.18.44'
    APPVERSION = '2.18.44'
    APPINFO = 'wyze_android_2.19.14' // Required for the thermostat
    SC = '9f275790cab94a72bd206c8876429f3c'
    SV = '9d74946e652647e9b6c9d59326aef104'
    AUTH_API_KEY = 'WMXHYf79Nr5gIlt3r0r7p9Tcw5bvs6BB4U8O8nGJ'
    USERAGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15'

    // Wyze Base urls
    AUTH_BASE_URL = 'https://auth-prod.api.wyze.com';
    API_BASE_URL = 'https://api.wyzecam.com';
    LOCK_BASE_URL = 'https://yd-saas-toc.wyzecam.com';

    // Wyze Login urls
    WYZE_USER_LOGIN = '/user/login';
    WYZE_REFRESH_TOKEN = '/app/user/refresh_token';

    // Wyze URLs
    LOCK_CONTROL_URL = '/openapi/lock/v1/control';
    LOCK_INFO_URL = '/openapi/lock/v1/info';


    WYZE_GET_OBJECT_LIST = '/app/v2/home_page/get_object_list';
    WYZE_GET_PROPERTY_LIST = '/app/v2/device/get_property_list';
    WYZE_SET_PROPERTY = '/app/v2/device/set_property';
    WYZE_LOCK_CONTROL_URL = '/openapi/lock/v1/control';
    WYZE_RUN_ACTION = '/app/v2/auto/run_action';
    WYZE_GET_DEVICE_INFO = '/app/v2/device/get_device_info';
    WYZE_RUN_ACTION_LIST = '/app/v2/auto/run_action_list';