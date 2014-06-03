#!/usr/bin/env node

var config = require('./config.json');

/* Notification handling */

var unreadNotifications = [];
var readNotifications = [];

// find index for new notification based on its timestamp
// assumes 'array' is sorted in ascending order according to .date fields
var findId = function(date, array) {
	for (var i = 0; i < array.length; i++) {
		if(array[i].date >= date)
			return i;
	}

	return array.length;
};

// store notification in (un)readNotifications array at a date sorted index
var storeNotification = function(data_json, read) {
	data_json.text = data_json.text.replace('\t',' '); // tabs to single spaces
	data_json.text = data_json.text.replace(/^\s*/, ""); // get rid of leading ws
	data_json.text = data_json.text.replace(/\s*$/, ""); // get rid of trailing ws

	// plugin did not provide timestamp, create one from current time
	if(!data_json.date)
		data_json.date = new Date().valueOf();

	var uid_dupe_found = false;
	var primaryArray = unreadNotifications; var secondaryArray = readNotifications;
	if(read) {
		primaryArray = readNotifications; secondaryArray = unreadNotifications;
	}

	// look for notification with duplicate UID in both arrays. if found, remove
	if(data_json.uid) {
		var i;
		for(i = 0; i < primaryArray.length; i++) {
			if(primaryArray[i].uid === data_json.uid) {
				primaryArray.splice(i, 1);
			}
		}
		// look in unread array too, if duplicate UID found there, remove it
		for(i = secondaryArray.length - 1; i >= 0; i--) {
			if(secondaryArray[i].uid === data_json.uid) {
				secondaryArray.splice(i, 1);
			}
		}
	}

	if (read) {
		// insert notification at end of readNotifications array
		readNotifications.push(data_json);

		// if readNotifications is full, pop from beginning
		if(readNotifications.length >= config.numReadToKeep) {
			readNotifications.splice(0, 1);
		}

		return readNotifications.length - 1;
	} else {
		// insert notification to unreadNotifications array
		var id = findId(data_json.date, unreadNotifications);
		unreadNotifications.splice(id, 0, data_json);

		return id;
	}
};

// return notifications with matching id, uid, source, context
// if id is given only it will be used. if id is undefined search using other
// fields. undefined fields not included in search.
var range_re = /(.*)\.\.(.*)/;
var searchNotifications = function(id, uid, source, context, read) {
	var array = read ? readNotifications : unreadNotifications;

	if(id) {
		var range = id.match(range_re);
		if(range) {
			var min = range[1] || 0;
			var max = range[2] || 9999999999999;

			if (min > max) {
				var temp = min;
				min = max;
				max = temp;
			}
			return array.filter(function (notification, i) {
				return (i >= min && i <= max);
			});
		} else {
			return array.filter(function (notification, i) {
				return i == id;
			});
		}
	} else {
		return array.filter(function (notification) {
			return (!uid || (notification.uid == uid)) && (!source || (notification.source == source)) && (!context || (notification.context == context));
		});
	}
};

var updateID = function() {
	var i;
	for (i = 0; i < unreadNotifications.length; i++) {
		unreadNotifications[i].unreadID = i;
		unreadNotifications[i].read = false;
	}
	for (i = 0; i < readNotifications.length; i++) {
		readNotifications[i].readID = i;
		readNotifications[i].read = true;
	}
};

// mark notifications as (un)read
// move notifications between (un)readNotifications arrays accordingly
// NOTE: all given notifications must already be in (un)readNotifications
var markAs = function(notifications, noSendResponse, read) {
	var msg = "";

	// check if arg is object, then make it into an array
	if(Object.prototype.toString.call(notifications) === '[object Object]') {
		notifications = [notifications];
	}

	var i;
	var notification;

	// update read boolean field of every given notification
	for (i = 0; i < notifications.length; i++) {
		notifications[i].read = read;
	}

	// loop through (un)readNotifications. see if we can find any that were
	// marked as (un)read and thus belong to the other array, move these
	if(read) {
		for(i = unreadNotifications.length - 1; i >= 0; i--) {
			if(unreadNotifications[i].read) {
				notification = unreadNotifications[i];
				unreadNotifications.splice(i, 1);
				storeNotification(notification, true);
			}
		}
	} else {
		for(i = readNotifications.length - 1; i >= 0; i--) {
			if(!readNotifications[i].read) {
				notification = readNotifications[i];
				readNotifications.splice(i, 1);
				storeNotification(notification, false);
			}
		}
	}
};

/* Networking */

var io = require('socket.io').listen(config.port);
console.log('nodifier server listening on port ' + config.port);
io.sockets.on('connection', function(socket) {
	var notifications;

	// add new notification
	socket.on('newNotification', function(n) {
		var id = storeNotification(n, false);
		updateID();

		// broadcast new notification to all other connected clients
		socket.broadcast.emit('newNotification', unreadNotifications[id]);
	});
	// search for notifications and mark results as (un)read according to s.read
	socket.on('markAs', function(s) {
		notifications = searchNotifications(s.id, s.uid, s.source, s.context, !s.read);
		if(notifications)
			markAs(notifications, s.noSendResponse, s.read);
		updateID();

		socket.emit('notifications', notifications);

		// broadcast updated notifications to all other connected clients
		socket.broadcast.emit('markAs', notifications);
	});
	// get all read notifications
	socket.on('getRead', function() {
		socket.emit('notifications', readNotifications);
	});
	// get unread notifications by id, or all notifications if no search terms
	socket.on('getUnread', function(s) {
		if(!s) {
			notifications = unreadNotifications;
		} else {
			notifications = searchNotifications(s.id, s.uid, s.source, s.context, false);
		}

		socket.emit('notifications', notifications);
	});
});

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("ERROR! Node not exiting.");
});
