const md5 = require('md5')
const crypto = require('crypto')
const utf8 = require('utf8')

const constants = require('./constants')


    function fordCreateSignature(url_path, request_method, data) {
        let body = request_method + url_path;
        let keys = Object.keys(data).sort()
        for (const element of keys) { // now lets iterate in sort order
            let key = element;
            let value = data[key];
            body += key + '=' + value + '&';
        }
        const payload = body.slice(0, -1).concat(constants.fordAppSecret)
        let urlencoded = encodeURIComponent(payload)
        let en = crypto.createHash('md5').update(utf8.encode(urlencoded))
        let dig = en.digest('hex')
        return dig
    }

    function oliveCreateSignatureSingle(payload, access_token) {
        let access_key = access_token + constants.oliveSigningSecret
        let secret = crypto.createHash('md5').update(utf8.encode(access_key))
        let secrestDig = secret.digest('hex')
        let hmac = crypto.createHmac("md5", utf8.encode(secrestDig)).update(utf8.encode(payload), crypto.md5)
        let digest = hmac.digest('hex')
        return digest
    }

    function oliveCreateSignature(payload, access_token) {
        let body = '';
        let keys = Object.keys(payload).sort()
        for (var i = 0; i < keys.length; i++) { // now lets iterate in sort order
            var key = keys[i];
            var value = payload[key];
            body += key + '=' + String(value) + '&';
        }

        body = body.slice(0, -1)
        let access_key = access_token + constants.oliveSigningSecret
        let secret = crypto.createHash('md5').update(utf8.encode(access_key))
        let secrestDig = secret.digest('hex')
        let hmac = crypto.createHmac("md5", utf8.encode(secrestDig)).update(utf8.encode(body), crypto.md5)
        let digest = hmac.digest('hex')
        return digest
    }

    module.exports = {
        fordCreateSignature,
        oliveCreateSignatureSingle,
        oliveCreateSignature
    }