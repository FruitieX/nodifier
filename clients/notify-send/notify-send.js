#!/usr/bin/env node

// send new nodifier notifications to system notification-daemon
var socketConnect = require('./../../lib/connect.js');

var setupEventHandlers = function(socket) {
	socket.on('newNotification', function(data) {
		var title = "";
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

	socket.on('close', function() {
		setupEventHandlers(socketConnect());
	});
	socket.setKeepAlive(true);
};

setupEventHandlers(socketConnect());

var spawn = require('child_process').spawn;
var launchDetached = function(program, args) {
	var child = spawn(program, args, {
		detached: true,
	});
	child.unref();
};
