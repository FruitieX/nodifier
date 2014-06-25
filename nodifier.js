#!/usr/bin/env node

var config = require('./config/config.js');
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

	var primaryArray = unreadNotifications; var secondaryArray = readNotifications;
	if(read) {
		primaryArray = readNotifications; secondaryArray = unreadNotifications;
	}

	// look for notification with duplicate UID in both arrays. if found, remove
	if(data_json.uid) {
		var i;
		for(i = primaryArray.length - 1; i >= 0; i--) {
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
var range_re = /(\d*)\.\.(\d*)/;
var searchNotifications = function(id, uid, source, context, read) {
	var array = read ? readNotifications : unreadNotifications;

	if(id) {
		var range = id.match(range_re);
		if(range) {
			var min = range[1] || 0;
			var max = range[2] || 9999999999999;
			min = parseInt(min);
			max = parseInt(max);

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
			return (!uid || (notification.uid == uid)) && (!source || (notification.source.toUpperCase() == source.toUpperCase())) && (!context || (notification.context.toUpperCase() == context.toUpperCase()));
		});
	}
};

// update .(un)readID and .read properties of all notifications
var updateIDRead = function() {
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
var markAs = function(notifications, read) {
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

// networking
var tls = require('tls')
var fs = require('fs');
var options = {
	key: fs.readFileSync('config/nodifier-key.pem'),
	cert: fs.readFileSync('config/nodifier-cert.pem'),
	ca: fs.readFileSync('config/nodifier-cert.pem'),
	requestCert: true,
	rejectUnauthorized: true
};
var sockets = [];
var server = tls.createServer(options, function(socket) {
	sockets.push(socket);
	var notifications;

	socket.on('data', function(data) {
		data = JSON.parse(data.toString());
		if(data[0] !== 'data')
			socket.emit(data[0], data[1]);
	});
	socket.send = function(evt, data) {
		socket.write(JSON.stringify([evt, data]));
	};
	socket.broadcast = function(evt, data, ignoreSelf) {
		for(var i = 0; i < sockets.length; i++) {
			if(!ignoreSelf || sockets[i] !== socket) {
				sockets[i].send(evt, data);
			}
		}
	};
	socket.on('end', function() {
		if(sockets.indexOf(socket) !== -1)
			sockets.splice(sockets.indexOf(socket), 1);
	});

	socket.on('newNotification', function(notification) {
		// add new notification
		var id = storeNotification(notification, false);
		updateIDRead(); // indices may have changed, fix them

		// broadcast new notification to all connected clients
		socket.broadcast('newNotification', unreadNotifications[id]);
	});
	socket.on('markAs', function(search) {
		// search for notifications and mark results as (un)read according to s.read
		notifications = searchNotifications(search.id, search.uid, search.source, search.context, !search.read);
		if(notifications)
			markAs(notifications, search.read);
		updateIDRead(); // indices/read states may have changed, fix them

		socket.send('notifications', notifications);

		// broadcast updated notifications to all other connected clients
		socket.broadcast('markAs', notifications, true);
	});
	socket.on('getRead', function() {
		socket.send('notifications', readNotifications);
	});
	socket.on('getUnread', function(search) {
		// get unread notifications by id, or all notifications if no search terms
		if(!search) {
			notifications = unreadNotifications;
		} else {
			notifications = searchNotifications(search.id, search.uid, search.source, search.context, false);
		}

		socket.send('notifications', notifications);
	});
});

server.listen(config.port);
console.log('nodifier tls server listening on port ' + config.port);

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("ERROR! Node not exiting.");
});
