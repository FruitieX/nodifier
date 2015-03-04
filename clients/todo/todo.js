#!/usr/bin/env node

// todo plugin for quick adding of todos
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

if(!process.argv[2]) {
    console.log("Usage: todo [message]");
    process.exit(1);
}

var str = "";
for (var i = 2; i < process.argv.length; i++) {
    str += process.argv[i] + ' ';
}
str.substring(0, str.length - 1);

socket.on('newNotification', function(data) {
    console.log('Notification added');
    socket.close();
});
socket.on('connect', function() {
    socket.emit('newNotification', {
        'text': str,
        'source': 'todo',
        'sourcebg': 'blue',
        'sourcefg': 'black'
    });
});
