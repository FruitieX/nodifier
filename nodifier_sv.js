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

// array containing notifications (as JSON)
var n = [];
var N_SIZE = 1000;
// max length (in chars) of the n_pos number, log base conversion needed
var N_LENGTH = Math.ceil(Math.log(N_SIZE) / Math.log(10));
var n_pos = 0;

// regex for matching getprev urls, remembers the digit
var url_re = /getprev\/(\d+)/;

var pos_with_leading_zeros = function() {
	// pad with leading zeros
	var leading_zeros = '';
	for(var i = 0; i < N_LENGTH - 1; i++)
		leading_zeros += '0';
	return String(leading_zeros + n_pos).slice(N_LENGTH * -1);
};

// put notification to array at pos n_pos and increment n_pos
var n_append = function(data) {
	delete data.method;

	data.id = pos_with_leading_zeros();
	data.date = new Date().valueOf();
	n[n_pos++] = data;

	// wrap n_pos to the beginning of the array if it starts growing big
	if(n_pos >= N_SIZE) {
		n_pos = 0;
	}
};

var n_mark_as_read = function(notification) {
	notification.read = true;
}

var n_mark_as_unread = function(notification) {
	notification.read = false;
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

s = http.createServer(basic, function (req, res) {
	if (req.method == 'POST') {
		req.on('data', function(data) {
			var data_json = querystring.parse(data.toString());

			if (!data_json.read)
				data_json.read = false; // we don't like undefined

			if (data_json.method === 'newNotification') {
				var source_color = def_source_color;
				if(data_json.colorfg)
					source_color = clc_color.color_from_text(data_json.colorfg, data_json.colorbg);

				var date_string = new Date().toTimeString().split(' ')[0] + ' ';

				var pos_string = pos_with_leading_zeros();

				// store POST in notifications array, note: make copy of object
				n_append(JSON.parse(JSON.stringify(data_json)));

				// if the string is wider than our terminal we need to shorten it
				var source_text_length = 5 + pos_string.length + data_json.source.length + date_string.length;
				var text_length = data_json.text.length;
				if(source_text_length + text_length > process.stdout.columns)
					data_json.text = data_json.text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

				console.log(date_color(date_string) + id_color(' ' + pos_string + ' ') + source_color(' ' + data_json.source + ' ') + ' ' + data_json.text);

				resMsg(res, 200, "Notification added.");
			} else if (data_json.method === 'setUnread') {
				var notification = n[data_json.id];
				if(!notification) {
					resMsg(res, 404, "Notification with id " + data_json.id + " not found.");
					return;
				}
				n_mark_as_unread(notification);

				resMsg(res, 200, "Notification set as unread.");
			} else if (data_json.method === 'setRead') {
				var notification = n[data_json.id];
				if(!notification) {
					resMsg(res, 404, "Notification with id " + data_json.id + " not found.");
					return;
				}
				n_mark_as_read(notification);

				resMsg(res, 200, "Notification set as read.");
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

		var getprev = resource.match(url_re);
		if(getprev) { // fetch multiple notifications, starting from latest
			var num_notifications = getprev[1];
			var notifications = [];

			var i;
			var id = n_pos - num_notifications;
			if (id < 0)
				id += N_SIZE;

			for(i = id; i < id + num_notifications && i < N_SIZE; i++) {
				var notification = n_fetch(i)
					if(notification && !notification.read)
						notifications.push(notification);
			}

			// if we overflowed N_SIZE, take the rest from index 0 and up
			if (id + num_notifications >= N_SIZE) {
				for(i = 0; i < num_notifications - (N_SIZE - id); i++) {
					var notification = n_fetch(i)
						if(notification && !notification.read)
							notifications.push(notification);
				}
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
