const md5 = require('md5')
const crypto = require('crypto')
const cryptojs = require('crypto-js')
const utf8 = require('utf8')

const constants = require('./constants')

module.exports = class crypto {

    ford_create_signature(url_path, request_method, data) {
        var body = request_method + url_path;
        var keys = Object.keys(data).sort()
        for (var i = 0; i < keys.length; i++) { // now lets iterate in sort order
            var key = keys[i];
            var value = data[key];
            body += key + '=' + value + '&';
        }
        const payload = body.slice(0, -1).concat(constants.FORD_APP_SECRET)
        var urlencoded = encodeURIComponent(payload)
        var en = crypto.createHash('md5').update(utf8.encode(urlencoded))
        var dig = en.digest('hex')
        return dig
    }
    olive_create_signature_single(payload, access_token) {
        var access_key = access_token + constants.OLIVE_SIGNING_SECRET
        var secret = crypto.createHash('md5').update(utf8.encode(access_key))
        var secrestDig = secret.digest('hex')
        var hmac = crypto.createHmac("md5", utf8.encode(secrestDig)).update(utf8.encode(payload), crypto.md5)
        var digest = hmac.digest('hex')
        return digest
    }

    olive_create_signature(payload, access_token) {
        var body = '';
        var keys = Object.keys(payload).sort()
        for (var i = 0; i < keys.length; i++) { // now lets iterate in sort order
            var key = keys[i];
            var value = payload[key];
            body += key + '=' + String(value) + '&';
        }

        body = body.slice(0, -1)
        var access_key = access_token + constants.OLIVE_SIGNING_SECRET
        var secret = crypto.createHash('md5').update(utf8.encode(access_key))
        var secrestDig = secret.digest('hex')
        var hmac = crypto.createHmac("md5", utf8.encode(secrestDig)).update(utf8.encode(body), crypto.md5)
        var digest = hmac.digest('hex')
        return digest
    }

}