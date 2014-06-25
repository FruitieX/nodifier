#!/usr/bin/env node

// template client program
var socket = require('./../../lib/connect.js');;

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
socket.on('auth', function() {
	socket.eventSend('newNotification', {
		'text': 'notification text goes here',
		'source': 'testapp',
		'sourcebg': 'blue',
		'sourcefg': 'black'
	});
	socket.eventSend('markAs', {
		'read': true,
		'source': 'testapp'
	});
	socket.eventSend('getRead');
	socket.eventSend('getUnread', {
		'id': '5..42'
	});
});
