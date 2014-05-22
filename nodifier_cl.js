#!/usr/bin/env node

var https = require('https');
var clc = require('cli-color');
var clc_color = require('./lib/clc-color');

var config = require('./config.json');
var htpasswd = require('./htpasswd.json');
var post = require('./lib/post.js');

var path;

var range_re = /(.*)\.\.(.*)/;
var spawn = require('child_process').spawn;
var launchProgram = function(program, url) {
	var command = config.programs[program];
	if(!command) {
		console.log("Unknown program: " + program + "!");
		return;
	}

	var child = spawn(command, [url], {
		detached: true,
		stdio: [ 'ignore', 'ignore', 'ignore' ]
	});

	child.unref();
};

var notificationsCache;

if (process.argv[2] === 'u') { // mark notification as unread
	if(!process.argv[3]) {
		console.log("Please provide notification ID!");
		process.exit(1);
	}

	post.sendPOST({
		'method': 'setUnread',
		'id': process.argv[3]
	});
} else if (process.argv[2] === 'r') { // mark notification as unread
	if(!process.argv[3]) {
		console.log("Please provide notification ID!");
		process.exit(1);
	}

	post.sendPOST({
		'method': 'setRead',
		'id': process.argv[3]
	});
} else { // get notification
	var n_id = process.argv[2];

	if (n_id === "lr") // list read
		path = '/read';
	else if (n_id === "l") { // 'listen' for notifications
		path = '/all';

		var onquit = function() {
			process.stdout.write('\n');
			// show cursor again
			process.stdout.write('\x1b[?25h');
			process.exit();
		};
		// hide cursor
		process.stdout.write('\x1b[?25l');
		process.on('SIGINT', onquit); process.on('exit', onquit);

		var stdin = process.stdin;
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding( 'utf8' );

		stdin.on('data', function(key) {
			if(key == 'q' || key == '\u0003') onquit();
		});

		process.stdout.on('resize', function() {
			// clear the terminal
			process.stdout.write('\u001B[2J\u001B[0;0f');

			if(notificationsCache.length) {
				for(i = 0; i < notificationsCache.length; i++) {
					printNotification(notificationsCache[i], i, true);
					if (n_id !== "l" || i != notificationsCache.length -1)
						process.stdout.write('\n');
					else
						process.stdout.write('\r');
				}
			} else {
				console.log(clc_color.no_unread_color("No unread notifications."));
			}
		});
	}
	else if (n_id)
		path = '/' + n_id;
	else
		path = '/all';

	var printNotification = function(notification, id, shorten) {
		var source_color = clc_color.def_source_color;
		if(notification.sourcefg || notification.sourcebg)
			source_color = clc_color.color_from_text(notification.sourcefg, notification.sourcebg);
		var context_color = clc_color.def_context_color;
		if(notification.contextfg || notification.contextbg)
			context_color = clc_color.color_from_text(notification.contextfg, notification.contextbg);

		var date_arr = new Date(notification.date).toString().split(' ');
		var date_string = date_arr[1] + ' ' + date_arr[2] + ' ' + date_arr[4].substr(0, 5) + ' ';

		var pos_string = id.toString();

		// find length of string before notification.text, shorten notification.text if
		// wider than our terminal
		var source_string = ''; context_string = '';
		if(notification.source)
			source_string = ' ' + notification.source + ' ';
		if(notification.context)
			context_string = ' ' + notification.context + ' ';

		var pre_text = date_string + ' ' + pos_string + ' ' + source_string + context_string + ' ';
		var text_length = notification.text.length;
		var text = notification.text
		if(shorten && pre_text.length + text_length > process.stdout.columns)
			text = text.substr(0, process.stdout.columns - pre_text.length - 3) + '...';

		process.stdout.write(clc_color.date_color(date_string) + clc_color.id_color(' ' + pos_string + ' ') + source_color(source_string) + context_color(context_string) + ' ' + text);
	};

	var makeReq = function(customPath) {
		var options = {
			hostname: config.host,
			port: config.port,
			path: path,
			method: 'GET',
			rejectUnauthorized: false,
			auth: htpasswd.username + ':' + htpasswd.password
		};

		if(customPath)
			options.path = customPath;

		var req = https.request(options, function(res) {
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
					var notifications = [];
					var i;

					if (n_id && n_id !== "lr" && n_id !== "l") { // requested a specific notification or a range
						var range = n_id.match(range_re);
						if(!range)
							notifications = [json_data];
						else
							notifications = json_data;
						notificationsCache = notifications;

						for(i = 0; i < notifications.length; i++) {
							printNotification(notifications[i], i, false);
							if (n_id !== "l" || i != notifications.length -1)
								process.stdout.write('\n');
							else
								process.stdout.write('\r');

							if(notifications[i].openwith) {
								launchProgram(notifications[i].openwith, notifications[i].url);
							}
						}

						if(config.autoMarkRead) {
							post.sendPOST({
								'method': 'setRead',
								'id': n_id
							}, true);
						}
					}
					else { // requested all notifications
						if(n_id === "l") { // poll for more notifications after 10 seconds
							// clear the terminal
							process.stdout.write('\u001B[2J\u001B[0;0f');

							// do a longpoll request after 1 sec
							setTimeout(function() {
								makeReq('/longpoll');
							}, 1000);
						}
						notificationsCache = json_data;
						if(json_data.length) {
							for(i = 0; i < json_data.length; i++) {
								printNotification(json_data[i], i, true);
								if (n_id !== "l" || i != json_data.length -1)
									process.stdout.write('\n');
								else
									process.stdout.write('\r');
							}
						} else {
							console.log(clc_color.no_unread_color("No unread notifications."));
						}
					}
				}
			});
		});

		req.end();
	};
	makeReq();
}
