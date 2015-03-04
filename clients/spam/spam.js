#!/usr/bin/env node

// spam plugin, useful for testing
var fs = require('fs');

var config = require(process.env.HOME + '/.nodifier/config.js');
var options = {
    tls: config.tls,
    key: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-key.pem'),
    cert: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    ca: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    rejectUnauthorized: config.rejectUnauthorized
};

var socket = require('socket.io-client')((config.tls ? 'https://' : 'http://') + config.host + ':' + config.port, options);

var cnt = 0;
socket.on('connect', function() {
    setInterval(function() {
        socket.emit('newNotification', {
            'text': 'spamäåö123456789atheoutheachumcramcrhkrcehachuechacmecuaocemuchaechucehaocumechoaceuhcmkch.phehlowhwhell' + cnt,
            'source': 'source' + cnt,
            'sourcebg': 'red',
            'sourcefg': 'white',
            'context': 'context' + cnt,
            'contextbg': 'blue',
            'contextfg': 'white',
            'openwith': 'openwith' + cnt,
            'url': 'url' + cnt
        });
        cnt++;
    }, 200);
});
