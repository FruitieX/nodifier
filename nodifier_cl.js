#!/usr/bin/env node

var http = require('http');
var clc = require('cli-color');
var clc_color = require('./lib/clc-color');

var config = require('./config.json');
var htpasswd = require('./htpasswd.json');
var post = require('./lib/post.js');

var path;

var spawn = require('child_process').spawn;
var launchApp = function(app, url) {
	var command = config.apps[app];
	if(!command) {
		console.log("Unknown app: " + app + "!");
		return;
	}

	var child = spawn(command, [url], {
		detached: true,
		stdio: [ 'ignore', 'ignore', 'ignore' ]
	});

	child.unref();
};

if (process.argv[2] === 'u') { // mark notification as unread
	post.sendPOST({
		'method': 'setUnread',
		'id': process.argv[3]
	});
} else if (process.argv[2] === 'r') { // mark notification as unread
	post.sendPOST({
		'method': 'setRead',
		'id': process.argv[3]
	});
} else { // get notification
	var n_id = process.argv[2];

	if (n_id)
		path = '/' + n_id;
	else
		path = '/all';

	var options = {
		hostname: config.host,
		port: config.port,
		path: path,
		method: 'GET',
		auth: htpasswd.username + ':' + htpasswd.password
	};

	var printNotification = function(notification, shorten) {
		var source_color = clc_color.def_source_color;
		if(notification.colorfg)
			source_color = clc_color.color_from_text(notification.colorfg, notification.colorbg);

		var date_string = new Date(notification.date).toTimeString().split(' ')[0] + ' ';

		var pos_string = notification.id.toString();

		// if the string is wider than our terminal we need to shorten it
		var source_text_length = 5 + pos_string.length + notification.source.length + date_string.length;
		var text_length = notification.text.length;
		if(shorten && source_text_length + text_length > process.stdout.columns)
			notification.text = notification.text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

		console.log(clc_color.date_color(date_string) + clc_color.id_color(' ' + pos_string + ' ') + source_color(' ' + notification.source + ' ') + ' ' + notification.text);
	};

	var req = http.request(options, function(res) {
		var contentLength = parseInt(res.headers['content-length']);
		var data = "";

		res.on('data', function(chunk) {
			data += chunk;

			// do we have all data?
			if (Buffer.byteLength(data, 'utf8') >= contentLength) {
				if(res.statusCode !== 200) {
					console.log('Response: ' + data);
					return;
				}

				var json_data = JSON.parse(data);

				if (n_id) {// requested only a specific notification
					printNotification(json_data, false);
					if(config.autoMarkRead) {
						post.sendPOST({
							'method': 'setRead',
							'id': n_id
						}, true);
					}

					if(json_data.app) {
						launchApp(json_data.app, json_data.url);
					}
				}
				else { // requested all notifications
					if(json_data.length) {
						for(var i = 0; i < json_data.length; i++) {
							if(json_data[i])
								printNotification(json_data[i], true);
						}
					} else {
						console.log(clc_color.no_unread_color("No unread notifications."));
					}
				}
			}
		});
	});

	req.end();
}
