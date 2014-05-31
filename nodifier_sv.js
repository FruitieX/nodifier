#!/usr/bin/env node

var config = require('./config.json');
var clc = require('cli-color');

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
	} else {
		// insert notification to unreadNotifications array
		var id = findId(data_json.date, unreadNotifications);
		unreadNotifications.splice(id, 0, data_json);
	}
};

// return notifications with matching id, uid, source, context
// if id is given only it will be used. if id is undefined search using other
// fields. undefined fields not included in search.
var range_re = /(.*)\.\.(.*)/;
var searchNotifications = function(id, uid, source, context, array) {
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
			})[0];
		}
	} else {
		return array.filter(function (notification) {
			return (!uid || (notification.uid == uid)) && (!source || (notification.source == source)) && (!context || (notification.context == context));
		});
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

		// if plugin supports updating read status, send update
		if(!noSendResponse)
			plugin_setReadStatus(notifications[i], state);
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

var io = require('socket.io')(config.port);

/*
var fs = require('fs');
var path = require('path');

var options = {
	key: fs.readFileSync(path.resolve(__dirname, config['ssl-key'])),
	cert: fs.readFileSync(path.resolve(__dirname, config['ssl-cert']))
};
*/
// report read status back to plugin
var plugin_setReadStatus = function(notification, read) {
	if(notification.uid && notification.response_host && notification.response_port) {
		var options = {
			hostname: notification.response_host,
			port: notification.response_port,
			path: '/' + read + '/' + notification.uid,
			method: 'GET',
			rejectUnauthorized: false,
			auth: htpasswd.username + ':' + htpasswd.password
		};

		var req = https.request(options);
		req.end();
	}
};


// regex for matching getprev urls, remembers the digit
var url_re_all = /all.*/;
var url_re_longpoll = /longpoll.*/;
var url_re_read = /read.*/;

var resMsg = function(res, statusCode, msg) {
	res.writeHead(statusCode, msg, {
		'Content-Type': 'text/html',
		'Content-Length': Buffer.byteLength(msg, 'utf8')
	});
	res.end(msg);
};

var resWriteJSON = function(res, data) {
	var data_json = JSON.stringify(data);
	res.writeHead(200, "OK", {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(data_json, 'utf8')
	});
	res.end(data_json);
};

var handlePOST = function(req, res) {
	var msg, notifications;

	req.on('data', function(data) {
		var data_json = querystring.parse(data.toString());

		if (data_json.method === 'newNotification') {
			// store POST in notifications array, note: make copy of object
			storeNotification(data_json, false);
			resLongpolls();

			resMsg(res, 200, "Notification added.");
		} else if (data_json.method === 'setUnread') {
			if (data_json.uid || data_json.source || data_json.context) {
				notifications = n_search_fetch(data_json.uid, data_json.source, data_json.context, readNotifications);
			} else {
				notifications = n_id_fetch(data_json.id, readNotifications);
			}
			if (!notifications) {
				resMsg(res, 404, "Notification not found.");
				return;
			}

			markAs(notifications, data_json.noSendResponse, "unread");
			resLongpolls();

			resWriteJSON(res, notifications);
		} else if (data_json.method === 'setRead') {
			if (data_json.uid || data_json.source || data_json.context) {
				notifications = n_search_fetch(data_json.uid, data_json.source, data_json.context, unreadNotifications);
			} else {
				notifications = n_id_fetch(data_json.id, unreadNotifications);
			}
			if (!notifications) {
				resMsg(res, 404, "Notification not found.");
				return;
			}

			markAs(notifications, data_json.noSendResponse, "read");
			resLongpolls();

			resWriteJSON(res, notifications);
		} else {
			resMsg(res, 404, "Unknown method in POST (should be 'newNotification', 'setUnread' or 'setRead')");
		}
	});

	req.on('end', function() {
		resMsg(res, 200, "OK");
	});
};

var handleGET = function(req, res) {
	var resource = url.parse(req.url).pathname;
	resource = resource.substr(1); // remove first slash

	var notifications;
	var all = resource.match(url_re_all);
	var longpoll = resource.match(url_re_longpoll);
	var read = resource.match(url_re_read);
	if(all) { // fetch all unread notifications
		notifications = n;
		resWriteJSON(res, notifications);
	} else if (longpoll) {
		longpolls.push(res);
	} else if (read) {
		notifications = readNotifications;
		resWriteJSON(res, notifications);
	} else { // fetch one notification or a range of notifications
		notifications = n_id_fetch(resource, n);

		if(notifications)
			resWriteJSON(res, notifications);
		else
			resMsg(res, 404, "Notification with id " + resource + " not found.");
	}
};

s = https.createServer(basic, options, function (req, res) {
	if (req.method == 'POST') {
		handlePOST(req, res);
	} else { // GET request
		handleGET(req, res);
	}
});

console.log(clc.green('nodifier server listening on port ' + config.port));
s.listen(config.port);

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("ERROR! Node not exiting.");
});
