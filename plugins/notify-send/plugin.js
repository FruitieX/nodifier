#!/usr/bin/env node

// send new nodifier notifications to system notification-daemon
var config = require('../../config.json');
var socket = require('socket.io-client')(config.host + ':' + config.port);
var spawn = require('child_process').spawn;

socket.on('connect', function() {
	socket.on('newNotification', function(data) {
		var s = "";
		if(data.source) {
			s += data.source;
		}
		if(data.context) {
			if(data.source)
				s += ' ';
			s += '(' + data.context + ')';
		}

		s += ': ';
		s += data.text;

		var child = spawn('notify-send', [s], {
			detached: true,
		});
		child.unref();
	});
});
