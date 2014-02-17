#!/usr/bin/env node

var http = require('http');
var clc = require('cli-color');
var clc_color = require('./lib/clc-color');

var id_color = clc.xterm(232).bgWhiteBright;
var date_color = clc.xterm(242);
var no_unread_color = clc.xterm(242);
var def_source_color = clc.whiteBright.bgXterm(232);

var config = require('./cfg/config_cl.json');
var htpasswd = require('./cfg/htpasswd.json');
var post = require('./lib/post.js');

var path;
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

	var printNotification = function(notification) {
		var source_color = def_source_color;
		if(notification.colorfg)
			source_color = clc_color.color_from_text(notification.colorfg, notification.colorbg);

		var date_string = new Date(notification.date).toTimeString().split(' ')[0] + ' ';

		// if the string is wider than our terminal we need to shorten it
		var source_text_length = 5 + notification.id.length + notification.source.length + date_string.length;
		var text_length = notification.text.length;
		if(source_text_length + text_length > process.stdout.columns)
			notification.text = notification.text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

		console.log(date_color(date_string) + id_color(' ' + notification.id + ' ') + source_color(' ' + notification.source + ' ') + ' ' + notification.text);
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

				if (n_id) // requested only a specific notification
					printNotification(json_data);
				else { // requested all notifications
					if(json_data.length) {
						for(var i = 0; i < json_data.length; i++) {
							if(json_data[i])
								printNotification(json_data[i]);
						}
					} else {
						console.log(no_unread_color("No unread notifications."));
					}
				}
			}
		});
	});

	req.end();
}
