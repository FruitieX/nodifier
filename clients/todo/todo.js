#!/usr/bin/env node

// todo plugin for quick adding of todos
var config = require('../../config/config.json');
var socket = require('socket.io-client').connect(config.host + ':' + config.port, {
	query: {token: config.token}
});

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
	socket.disconnect();
});
socket.on('connect', function() {
	socket.emit('newNotification', {
		'text': str,
		'source': 'todo',
		'sourcebg': 'blue',
		'sourcefg': 'black'
	});
});
