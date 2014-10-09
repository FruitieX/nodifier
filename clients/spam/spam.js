#!/usr/bin/env node

// spam plugin, useful for testing
var netEvent = require('net-event');
var fs = require('fs');

var config = require(process.env.HOME + '/.nodifier/config.js');
var options = {
    host: config.host,
    port: config.port,
    tls: config.tls,
    key: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-key.pem'),
    cert: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    ca: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    rejectUnauthorized: config.rejectUnauthorized
};

var socket = new netEvent(options);

var cnt = 0;
socket.on('open', function() {
    setInterval(function() {
        socket.send('newNotification', {
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
