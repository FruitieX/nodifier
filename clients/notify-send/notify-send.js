#!/usr/bin/env node

// send new nodifier notifications to system notification-daemon
var nodifierConnect = require('nodifier_connect');
var socket = new nodifierConnect();

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

var spawn = require('child_process').spawn;
var launchDetached = function(program, args) {
    var child = spawn(program, args, {
        detached: true,
    });
    child.unref();
};
