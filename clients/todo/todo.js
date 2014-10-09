#!/usr/bin/env node

// todo plugin for quick adding of todos
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
socket.on('open', function() {
    socket.send('newNotification', {
        'text': str,
        'source': 'todo',
        'sourcebg': 'blue',
        'sourcefg': 'black'
    });
});
