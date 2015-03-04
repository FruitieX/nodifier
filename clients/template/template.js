#!/usr/bin/env node

// template client program
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

socket.on('newNotification', function(notification) {
    // new notification arrived, print text property
    console.log('new notification: ' + notification.source + ': ' + notification.text);
});
socket.on('markAs', function(notifications) {
    // existing notifications' read property changed, print the old indices
    for (var i = 0; i < notifications.length; i++) {
        if(notifications[i].read)
            console.log('notification ' + notifications[i].unreadID + ' marked as read.');
        else
            console.log('notification ' + notifications[i].readID + ' marked as unread.');
    }
});
socket.on('notifications', function(notifications) {
    // server sent back a list of notifications that you've requested
    console.log('got list of notifications:');
    for (var i = 0; i < notifications.length; i++)
        console.log(notifications[i].source + ': ' + notifications[i].text)
});
socket.on('connect', function() {
    socket.emit('newNotification', {
        'text': 'notification text goes here',
        'source': 'testapp',
        'sourcebg': 'blue',
        'sourcefg': 'black'
    });
    socket.emit('markAs', {
        'read': true,
        'source': 'testapp'
    });
    socket.emit('getRead');
    socket.emit('getUnread', {
        'id': '5..42'
    });
});

socket.on('error', function(e) {
    console.log('socket error: ' + e);
});
