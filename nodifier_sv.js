#!/usr/bin/env node

var auth = require('http-auth');
var htpasswd = require('./htpasswd.json');
var basic = auth.basic({
	realm: "nodifier"
}, function (username, password, callback) {
	callback(username === htpasswd.username && password === htpasswd.password);
});

var https = require('https');
var url = require('url');
var querystring = require('querystring');
var clc = require('cli-color');
var clc_color = require('./lib/clc-color');
var config = require('./config.json');
var fs = require('fs');
var path = require('path');

var options = {
	key: fs.readFileSync(path.resolve(__dirname, config['ssl-key'])),
	cert: fs.readFileSync(path.resolve(__dirname, config['ssl-cert']))
};

/* Notification handling */

var n = []; // array containing unread notifications
var read_n = []; // array containing read notifications
var read_n_limit = config.numReadToKeep; // keep only this many read notifications

// find index for new notification based on its timestamp
// assumes 'array' is sorted in ascending order according to .date fields
var n_findId = function(date, array) {
	for (var i = 0; i < array.length; i++) {
		if(array[i].date >= date)
			return i;
	}

	return array.length;
};

// store unread notification in correct slot according to timestamp
var n_store_unread = function(data_json) {
	// get rid of weird characters
	data_json.text = data_json.text.replace('\t',' '); // convert tabs to single spaces
	data_json.text = data_json.text.replace(/^\s*/, ""); // get rid of leading spaces
	data_json.text = data_json.text.replace(/\s*$/, ""); // get rid of trailing spaces

	delete data_json.method;
	data_json.read = false;

	// plugin did not provide timestamp, create one from current time
	if(!data_json.date)
		data_json.date = new Date().valueOf();

	// replace old notification if duplicate UID with matching source found
	var uid_dupe_found = false;
	if(data_json.uid) {
		var i;
		for(i = 0; i < n.length; i++) {
			if(n[i].uid === data_json.uid && (!data_json.source || (n[i].source === data_json.source)) && (!data_json.context || (n[i].context === data_json.context))) {
				// TODO: for now keep date same so we don't mess up sorting!
				data_json.date = n[i].date;
				n[i] = data_json;
				uid_dupe_found = true;
			}
		}
		// look in read array too, if duplicate UID found there, remove it
		for(i = read_n.length - 1; i >= 0; i--) {
			if(read_n[i].uid === data_json.uid && (!data_json.source || (read_n[i].source === data_json.source)) && (!data_json.context || (read_n[i].context === data_json.context)))
				read_n.splice(i, 1);
		}
	}

	if (!uid_dupe_found) {
		var id = n_findId(data_json.date, n);

		// insert notification to "n" n at pos "id"
		n.splice(id, 0, data_json);
	}
};

var n_store_read = function(data_json) {
	delete data_json.method;
	data_json.read = true;
	data_json.text = data_json.text.replace('\t',' '); // convert tabs to single spaces
	data_json.text = data_json.text.replace(/^\s*/, ""); // get rid of leading spaces
	data_json.text = data_json.text.replace(/\s*$/, ""); // get rid of trailing spaces

	// plugin did not provide timestamp, create one from current time
	if(!data_json.date)
		data_json.date = new Date().valueOf();

	// replace old notification if duplicate UID with matching source found
	var uid_dupe_found = false;
	if(data_json.uid) {
		var i;
		for(i = 0; i < read_n.length; i++) {
			if(read_n[i].uid === data_json.uid && (!data_json.source || (read_n[i].source === data_json.source)) && (!data_json.context || (read_n[i].context === data_json.context))) {
				// TODO: for now keep date same so we don't mess up sorting!
				data_json.date = read_n[i].date;
				read_n[i] = data_json;
				uid_dupe_found = true;
			}
		}
		// look in unread array too, if duplicate UID found there, remove it
		for(i = n.length - 1; i >= 0; i--) {
			if(n[i].uid === data_json.uid && (!data_json.source || (n[i].source === data_json.source)) && (!data_json.context || (n[i].context === data_json.context)))
				n.splice(i, 1);
		}
	}

	if (!uid_dupe_found) {
		// insert notification at end of read_n array
		read_n.push(data_json);

		// if read_n is full, pop from start
		if(read_n.length == read_n_limit) {
			read_n.splice(0, 1);
		}
	}
};

var range_re = /(.*)\.\.(.*)/;
var n_id_fetch = function(id, array) {
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
};

// fetch notifications with matching uid, source, context
// (if any of these fields are left undefined, the field will not be included in search)
var n_search_fetch = function(uid, source, context, array) {
	return array.filter(function (notification) {
		return (!uid || (notification.uid == uid)) && (!source || (notification.source == source)) && (!context || (notification.context == context));
	});
};

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

// mark notifications as (un)read
// move notifications between "n" and "read_n" arrays accordingly
var n_mark_as = function(notifications, noSendResponse, state) {
	var msg = "";

	// check if arg is object, then make it into an array
	if(Object.prototype.toString.call(notifications) === '[object Object]') {
		notifications = [notifications];
	}

	// keep track if any notification was actually changed
	var update = false;

	var i;
	var notification;

	// update read boolean field of every given notification
	for (i = 0; i < notifications.length; i++) {
		if((state === "read" && !notifications[i].read) || (state === "unread" && notifications[i].read)) {
			// toggle read status
			notifications[i].read = !notifications[i].read;
			update = true;

			// if plugin supports updating read status, send update
			if(!noSendResponse)
				plugin_setReadStatus(notifications[i], state);

		}
	}

	if(update) {
		// loop through unread notifications
		// see if we can find any that were marked as read
		// remove and move these to "read_n"
		if(state === "read") {
			for(i = n.length - 1; i >= 0; i--) {
				if(n[i].read) {
					notification = n[i];
					n.splice(i, 1);
					n_store_read(notification);
				}
			}
		} else if (state === "unread") {
			for(i = read_n.length - 1; i >= 0; i--) {
				if(!read_n[i].read) {
					notification = read_n[i];
					read_n.splice(i, 1);
					n_store_unread(notification);
				}
			}
		}

		if(notifications.length > 1)
			msg = "Notifications set as " + state + ".";
		else
			msg = "Notification set as " + state + ".";
	} else {
		if(notifications.length > 1)
			msg = "All notifications already marked as " + state + ".";
		else
			msg = "Notification already marked as " + state + ".";
	}

	return msg;
};

/* Drawing */

var drawNotification = function(notification, id) {
	var source_color = clc_color.def_source_color;
	if(notification.sourcefg || notification.sourcebg)
		source_color = clc_color.color_from_text(notification.sourcefg, notification.sourcebg);
	var context_color = clc_color.def_context_color;
	if(notification.contextfg || notification.contextbg)
		context_color = clc_color.color_from_text(notification.contextfg, notification.contextbg);

	var date_arr = new Date(notification.date).toString().split(' ');
	var date_string = date_arr[1] + ' ' + date_arr[2] + ' ' + date_arr[4].substr(0, 5) + ' ';

	var pos_string = id.toString();

	// make a copy of the string before we potentially shorten
	var text = notification.text;

	// find length of string before text, shorten text if wider than our terminal
	var source_string, context_string;
	if(notification.source)
		source_string = ' ' + notification.source + ' ';
	if(notification.context)
		context_string = ' ' + notification.context + ' ';

	var pre_text = date_string + ' ' + pos_string + ' ' + source_string + context_string + ' ';
	var text_length = text.length;
	if(pre_text.length + text_length > process.stdout.columns)
		text = text.substr(0, process.stdout.columns - pre_text.length - 3) + '...';

	process.stdout.write(clc_color.date_color(date_string) + clc_color.id_color(' ' + pos_string + ' ') + source_color(source_string) + context_color(context_string) + ' ' + text);
};

var redraw = function() {
	// clear the terminal
	process.stdout.write('\u001B[2J\u001B[0;0f');

	var notifications = n;
	var len = notifications.length;

	// draw it
	if (len)
		for(var i = 0; i < len; i++) {
			drawNotification(notifications[i], i);
			if (i != len - 1)
				process.stdout.write('\n');
			else
				process.stdout.write('\r');
		}
	else
		console.log(clc_color.no_unread_color("No unread notifications."));
};

/* HTTP server */

// regex for matching getprev urls, remembers the digit
var url_re_all = /all.*/;
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
			n_store_unread(data_json);

			resMsg(res, 200, "Notification added.");
			redraw();
		} else if (data_json.method === 'setUnread') {
			if (data_json.uid || data_json.source || data_json.context) {
				notifications = n_search_fetch(data_json.uid, data_json.source, data_json.context, n);
			} else {
				notifications = n_id_fetch(data_json.id, read_n);
			}
			if (!notifications) {
				resMsg(res, 404, "Notification not found.");
				return;
			}

			msg = n_mark_as(notifications, data_json.noSendResponse, "unread");
			resMsg(res, 200, msg);
			redraw();
		} else if (data_json.method === 'setRead') {
			if (data_json.uid || data_json.source || data_json.context) {
				notifications = n_search_fetch(data_json.uid, data_json.source, data_json.context, n);
			} else {
				notifications = n_id_fetch(data_json.id, n);
			}
			if (!notifications) {
				resMsg(res, 404, "Notification not found.");
				return;
			}

			msg = n_mark_as(notifications, data_json.noSendResponse, "read");
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
	var read = resource.match(url_re_read);
	if(all) { // fetch all unread notifications
		notifications = n;
		resWriteJSON(res, notifications);
	} else if (read) {
		notifications = read_n;
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

console.log(clc.green('listening on port ' + config.port));
s.listen(config.port);

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("ERROR! Node not exiting.");
});
