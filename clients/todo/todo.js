#!/usr/bin/env node

// todo plugin for quick adding of todos
var socket = require('./../../lib/connect.js');;

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
socket.on('auth', function() {
	socket.eventSend('newNotification', {
		'text': str,
		'source': 'todo',
		'sourcebg': 'blue',
		'sourcefg': 'black'
	});
});
