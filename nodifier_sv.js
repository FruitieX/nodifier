#!/usr/bin/env node

var auth = require('http-auth');
var htpasswd = require('./cfg/htpasswd.json');
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
var config = require('./cfg/config_sv.json');

var id_color = clc.xterm(232).bgWhiteBright;
var date_color = clc.xterm(242);
var def_source_color = clc.whiteBright.bgXterm(232);

// array containing JSON notifications
var n = [];
// first empty slot in array. already read notifications count as empty
var n_firstEmpty = 0;

// regex for matching getprev urls, remembers the digit
var url_re_all = /all.*/;

// find next empty slot in array, starting from (but not including) start_id
// if array is full return n.length
var n_findNextEmpty = function(start_id) {
	for (var i = start_id + 1; i <= n.length; i++)
		if(!n[i] || !n[i].read)
			return i;
}

// store notification in the first empty slot and update n_firstEmpty
var n_append = function(data_json) {
	delete data_json.method;

	data_json.id = n_firstEmpty;
	data_json.date = new Date().valueOf();
	n[n_firstEmpty] = data_json;
	n_firstEmpty = n_findNextEmpty(n_firstEmpty);
};

var n_mark_as_read = function(notification) {
	if(!notification.read) {
		// if notification.id is smaller than n_firstEmpty then update that
		n_firstEmpty = Math.min(n_firstEmpty, notification.id);

		notification.read = true;
		return "Notification set as read.";
	} else {
		return "Notification already marked as read.";
	}
	// TODO: report back to plugin
}

var n_mark_as_unread = function(notification) {
	if(notification.read) {
		// if this notification was the first empty slot, update it
		if(n_firstEmpty === notification.id) {
			n_firstEmpty = n_findNextEmpty(notification.id);
		}

		notification.read = false;
		return "Notification set as unread.";
	} else {
		return "Notification already marked as unread.";
	}
	// TODO: report back to plugin
}

var n_fetch = function(id) {
	id = parseInt(id, 10); // remove leading zeros

	return n[id];
};

var resMsg = function(res, statusCode, msg) {
	res.writeHead(statusCode, msg, {
		'Content-Type': 'text/html',
		'Content-Length': Buffer.byteLength(msg, 'utf8')
	});
	res.end(msg);
}

var resWriteJSON = function(res, data) {
	var data_json = JSON.stringify(data);
	res.writeHead(200, "OK", {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(data_json, 'utf8')
	});
	res.end(data_json);
}

var drawNotification = function(notification) {
	var source_color = def_source_color;
	if(notification.colorfg)
		source_color = clc_color.color_from_text(notification.colorfg, notification.colorbg);

	var date_string = new Date(notification.date).toTimeString().split(' ')[0] + ' ';

	var pos_string = notification.id.toString();

	// if the string is wider than our terminal we need to shorten it
	var source_text_length = 5 + pos_string.length + notification.source.length + date_string.length;
	var text_length = notification.text.length;
	if(source_text_length + text_length > process.stdout.columns)
		notification.text = notification.text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

	console.log(date_color(date_string) + id_color(' ' + pos_string + ' ') + source_color(' ' + notification.source + ' ') + ' ' + notification.text);
}

var redraw = function() {
	// clear the terminal
	process.stdout.write('\u001B[2J\u001B[0;0f');

	for(var i = 0; i < process.stdout.rows; i++) {
		if(i >= n.length) {
			console.log(n_firstEmpty);
			return;
		}
		if(n[i].read) // don't show read notifications
			continue;

		drawNotification(n[i]);
	}
}

s = http.createServer(basic, function (req, res) {
	if (req.method == 'POST') {
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
				var notification = n[data_json.id];
				if(!notification) {
					resMsg(res, 404, "Notification with id " + data_json.id + " not found.");
					return;
				}
				var msg = n_mark_as_unread(notification);

				resMsg(res, 200, msg);
				redraw();
			} else if (data_json.method === 'setRead') {
				var notification = n[data_json.id];
				if(!notification) {
					resMsg(res, 404, "Notification with id " + data_json.id + " not found.");
					return;
				}
				var msg = n_mark_as_read(notification);

				resMsg(res, 200, msg);
				redraw();
			} else {
				resMsg(res, 404, "Unknown method in POST (should be 'newNotification', 'setUnread' or 'setRead')");
			}
		});

		// TODO: is this needed?
		req.on('end', function() {
			resMsg(res, 200, "OK");
		});
	} else {
		var resource = url.parse(req.url).pathname;
		resource = resource.substr(1);

		var all = resource.match(url_re_all);
		if(all) { // fetch all unread notifications
			var notifications = [];

			for(i = 0; i < n.length; i++) {
				var notification = n_fetch(i);
					if(notification && !notification.read)
						notifications.push(notification);
			}

			resWriteJSON(res, notifications);
		}
		else { // fetch only one notification
			notification = n_fetch(resource);

			if(notification)
				resWriteJSON(res, notification);
			else
				resMsg(res, 404, "Notification with id " + resource + " not found.");
		}
	}
});

process.stdout.write('\u001B[2J\u001B[0;0f');
console.log(clc.green('listening on port ' + config.port));
s.listen(config.port);

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("Node NOT Exiting...");
});
