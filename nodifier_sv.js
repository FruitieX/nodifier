#!/usr/bin/env node

var auth = require('http-auth');
var htpasswd = require('./htpasswd.json');
var basic = auth.basic({
	realm: "nodifier"
}, function (username, password, callback) {
	callback(username === htpasswd.username && password === htpasswd.password);
});

var http = require('http');
var url = require('url');
var querystring = require('querystring');
var clc = require('cli-color');
var clc_color = require('./lib/clc-color');
var config = require('./config.json');

/* Notification handling */

// array containing JSON notifications
var n = [];
// first empty slot in array. already read notifications count as empty
var n_firstEmpty = 0;

// sort according to date (epoch)
var dateSort = function(a, b) {
	return a.date - b.date;
};

// find next empty slot in array, starting from (but not including) start_id
// if array is full return n.length
var n_findNextEmpty = function(start_id) {
	for (var i = start_id + 1; i <= n.length; i++)
		if(!n[i] || n[i].read)
			return i;
};

// store notification in the first empty slot and update n_firstEmpty
var n_append = function(data_json) {
	delete data_json.method;

	// duplicate uid, ignore
	if(data_json.uid) {
		for(var i = 0; i < n.length; i++) {
			if(n[i].uid === data_json.uid && n[i].source === data_json.source)
				// old matching notification was set as read, overwrite
				if(n[i].read) {
					n[i].invalidated = true;
					break;
				// else don't overwrite old matching unread notification
				} else {
					return;
				}
		}
	}

	data_json.id = n_firstEmpty;
	// plugin did not provide timestamp, create one from current time
	if(!data_json.date)
		data_json.date = new Date().valueOf();
	n[n_firstEmpty] = data_json;
	n_firstEmpty = n_findNextEmpty(n_firstEmpty);
};

var range_re = /(.*)\.\.(.*)/;
var n_fetch = function(id) {
	var range = id.match(range_re);
	if(range) {
		return n.filter(function (notification) {
			return (notification.id >= range[1] && notification.id <= range[2]);
		});
	} else {
		return n.filter(function (notification) {
			return notification.id == id;
		})[0];
	}
};

var n_uid_fetch = function(uid) {
	return n.filter(function (notification) {
		return notification.uid == uid;
	})[0];
};

var n_fetchAllUnread = function() {
	var notifications = [];

	// populate notifications array with unread messages
	for(i = 0; i < n.length; i++) {
		notification = n_fetch(i.toString());
		if(notification && !notification.read)
			notifications.push(notification);
	}

	// sort it
	notifications.sort(dateSort);

	return notifications;
};

var plugin_setReadStatus = function(notification, read) {
	if(notification.uid && notification.response_host && notification.response_port) {
		var options = {
			hostname: notification.response_host,
			port: notification.response_port,
			path: '/' + read + '/' + notification.uid,
			method: 'GET',
			auth: htpasswd.username + ':' + htpasswd.password
		};

		var req = http.request(options);
		req.end();
	}
};

var n_mark_as_read = function(notifications, noSendResponse) {
	var msg = "";

	// check if arg is object, then make it into an array
	if(Object.prototype.toString.call(notifications) === '[object Object]') {
		notifications = [notifications];
	}

	for (var i = 0; i < notifications.length; i++) {
		if(!notifications[i].read) {
			// if notification.id is smaller than n_firstEmpty then update that
			n_firstEmpty = Math.min(n_firstEmpty, notifications[i].id);

			notifications[i].read = true;
			if(!noSendResponse)
				plugin_setReadStatus(notifications[i], 'read');

			if(notifications.length > 1)
				msg = "Notifications set as read.";
			else
				msg = "Notification set as read.";
		} else if (msg === "") {
			if(notifications.length > 1)
				msg = "All notifications already marked as read.";
			else
				msg = "Notification already marked as read.";
		}
	}

	return msg;
};

var n_mark_as_unread = function(notifications, noSendResponse) {
	var msg = "";

	// check if arg is object, then make it into an array
	if(Object.prototype.toString.call(notifications) === '[object Object]') {
		notifications = [notifications];
	}

	for (var i = 0; i < notifications.length; i++) {
		if(notifications[i].invalidated) {
			return "ERROR: Tried setting outdated/invalidated notification " + notifications[i].id + " as unread! Quitting...";
		}
		if(notifications[i].read) {
			// if this notification was the first empty slot, update it
			if(n_firstEmpty === notifications[i].id) {
				n_firstEmpty = n_findNextEmpty(notifications[i].id);
			}

			notifications[i].read = false;
			if(!noSendResponse)
				plugin_setReadStatus(notifications[i], 'unread');
			if(notifications.length > 1)
				msg = "Notifications set as unread.";
			else
				msg = "Notification set as unread.";
		} else if (msg === "") {
			if(notifications.length > 1)
				msg = "All notifications already marked as unread.";
			else
				msg = "Notification already marked as unread.";
		}
	}

	return msg;
};

/* Drawing */

var drawNotification = function(notification) {
	var source_color = clc_color.def_source_color;
	if(notification.colorfg)
		source_color = clc_color.color_from_text(notification.colorfg, notification.colorbg);

	var date_arr = new Date(notification.date).toString().split(' ');
	var date_string = date_arr[1] + ' ' + date_arr[2] + ' ' + date_arr[4].substr(0, 5) + ' ';

	var pos_string = notification.id.toString();

	// make a copy of the string before we potentially shorten
	var text = notification.text;
	// if the string is wider than our terminal we need to shorten it
	var source_text_length = 5 + pos_string.length + notification.source.length + date_string.length;
	if(source_text_length + text.length > process.stdout.columns)
		text = text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

	console.log(clc_color.date_color(date_string) + clc_color.id_color(' ' + pos_string + ' ') + source_color(' ' + notification.source + ' ') + ' ' + text);
};

var redraw = function() {
	// clear the terminal
	process.stdout.write('\u001B[2J\u001B[0;0f');

	var notifications = n_fetchAllUnread();
	var len = notifications.length;

	// draw it
	if (len)
		// TODO: figure out how to disable the prompt so we get one line more...
		for(var i = 0; i < len; i++)
			drawNotification(notifications[i]);
	else
		console.log(clc_color.no_unread_color("No unread notifications."));
};

/* HTTP server */

// regex for matching getprev urls, remembers the digit
var url_re_all = /all.*/;

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
	var msg, notification;

	req.on('data', function(data) {
		var data_json = querystring.parse(data.toString());

		if (!data_json.read)
			data_json.read = false; // we don't like undefined

		if (data_json.method === 'newNotification') {
			// store POST in notifications array, note: make copy of object
			n_append(data_json);

			resMsg(res, 200, "Notification added.");
			redraw();
		} else if (data_json.method === 'setUnread') {
			if(data_json.uid) {
				notification = n_uid_fetch(data_json.uid);
				if (!notification) {
					resMsg(res, 404, "Notification with uid " + data_json.uid + " not found.");
					return;
				}
			} else {
				notification = n_fetch(data_json.id);
				if (!notification) {
					resMsg(res, 404, "Notification with id " + data_json.id + " not found.");
					return;
				}
			}

			msg = n_mark_as_unread(notification, data_json.noSendResponse);
			resMsg(res, 200, msg);
			redraw();
		} else if (data_json.method === 'setRead') {
			if(data_json.uid) {
				notification = n_uid_fetch(data_json.uid);
				if (!notification) {
					resMsg(res, 404, "Notification with uid " + data_json.uid + " not found.");
					return;
				}
			} else {
				notification = n_fetch(data_json.id);
				if (!notification) {
					resMsg(res, 404, "Notification with id " + data_json.id + " not found.");
					return;
				}
			}

			msg = n_mark_as_read(notification, data_json.noSendResponse);
			resMsg(res, 200, msg);
			redraw();
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
	if(all) { // fetch all unread notifications
		notifications = n_fetchAllUnread();
		resWriteJSON(res, notifications);
	} else { // fetch one notification or a range of notifications
		notifications = n_fetch(resource);

		if(notifications)
			resWriteJSON(res, notifications);
		else
			resMsg(res, 404, "Notification with id " + resource + " not found.");
	}
};

s = http.createServer(basic, function (req, res) {
	if (req.method == 'POST') {
		handlePOST(req, res);
	} else { // GET request
		handleGET(req, res);
	}
});

console.log(clc.green('listening on port ' + config.port));
s.listen(config.port);

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("ERROR! Node not exiting.");
});
