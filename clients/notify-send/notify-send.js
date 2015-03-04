#!/usr/bin/env node

// send new nodifier notifications to system notification-daemon
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

socket.on('newNotification', function(data) {
    var title = '';

    if(data.unreadID) {
        title += '#' + data.unreadID +': ';
    }
    if(data.source) {
        title += data.source;
    }
    if(data.context) {
        if(data.source)
            title += ' ';
        title += '(' + data.context + ')';
    }

    launchDetached('notify-send', [title, data.text]);
    launchDetached('paplay', ['/usr/share/sounds/freedesktop/stereo/message.oga']);
});

socket.on('error', function(e) {
    console.log('socket error: ' + e);
});

var spawn = require('child_process').spawn;
var launchDetached = function(program, args) {
    var child = spawn(program, args, {
        detached: true,
    });
    child.unref();
};
