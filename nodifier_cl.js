#!/usr/bin/env node

var clc = require('cli-color');
var clc_color = require('./lib/clc-color');

var config = require('./config.json');

var range_re = /(.*)\.\.(.*)/;
var spawn = require('child_process').spawn;
var launchProgram = function(notification) {
	var command = config.programs[notification.openwith];
	if(!command) {
		console.log("Unknown program: " + notification.openwith + "!");
		return;
	}

	var child = spawn(command, [notification.url], {
		detached: true,
		stdio: [ 'ignore', 'ignore', 'ignore' ]
	});

	child.unref();
};

var notificationsCache;

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

var printNotifications = function(notifications, listenMode) {
	// listen mode should clear terminal
	if(listenMode)
		process.stdout.write('\u001B[2J\u001B[0;0f');

	if(notifications && notifications.length) {
		for(i = 0; i < notifications.length; i++) {
			printNotification(notifications[i], i, true);

			// no newline after last notification in listen mode, fits one more onscreen
			if (listenMode && i == notifications.length - 1)
				process.stdout.write('\r');
			else
				process.stdout.write('\n');
		}
	} else {
		console.log(clc_color.no_unread_color("No notifications."));
	}
};

var addNotification = function(notification) {
	notificationsCache.append(notification)
	notificationsCache.sort(function(a, b) {
		return a.date - b.date;
	});
};

var socket = require('socket.io-client')(config.host + ':' + config.port);
socket.on('connect', function() {
	// these commands return a list of notifications and should print it
	if(new Array('u', 'r', 'lr', undefined).indexOf(process.argv[2]) !== -1
		|| /(\d).*/.test(process.argv[2])) {

		socket.on('notifications', function(notifications) {
			printNotifications(notifications, false);

			if(/(\d).*/.test(process.argv[2]) && notifications)
				launchProgram(notifications[0]);

			// non listen modes should exit now
			process.exit(0);
		});
	}

	switch(process.argv[2]) {
		// mark as (un)read
		case 'u':
		case 'r':
			if(!process.argv[3]) {
				console.log("Please provide notification ID!");
				process.exit(1);
			}

			socket.emit('markAs', {
				'read': (process.argv[2] === 'r' ? true : false),
				'id': process.argv[3]
			});
			break;

		// list read notifications
		case 'lr':
			socket.emit('getRead');
			break;

		// 'listen' for notifications
		case 'l':
			socket.on('notifications', function(notifications) {
				notificationsCache = notifications;
				printNotifications(notifications, true);
			});
			socket.on('markAs', function(notifications) {
				for (var i = 0; i < notifications.length; i++) {
					if (notifications[i].read) {
						// notification marked as read, remove
						notificationsCache.splice(notificationsCache.indexOf(notifications[i], 1));
					} else {
						// new notification, add and sort
						addNotification(notifications[i]);
					}
				}
			});
			socket.on('newNotification', function(notification) {
				// new notification, add and sort
				addNotification(notification);
			});

			// hide cursor
			process.stdout.write('\x1b[?25l');

			// show cursor again after program exit
			var onquit = function() {
				process.stdout.write('\n');
				process.stdout.write('\x1b[?25h');
				process.exit();
			};

			// catch ctrl-c
			process.on('SIGINT', onquit); process.on('exit', onquit);

			// hide keyboard input
			var stdin = process.stdin;
			stdin.setRawMode(true);
			stdin.resume();
			stdin.setEncoding( 'utf8' );

			// look for q keypresses, run onquit
			stdin.on('data', function(key) {
				if(key == 'q' || key == '\u0003') onquit();
			});

			// handle resizes
			process.stdout.on('resize', function() {
				printNotifications(notificationsCache, true);
			});

			// get all unread notifications once
			socket.emit('getUnread');
			break;

		default:
			// requested a certain notification
			if(/(\d).*/.test(process.argv[2])) {
				socket.emit('getUnread', {
					id: process.argv[2]
				});
			}
			
			// requested all notifications
			else {
				socket.emit('getUnread');
			}

			break;
	}
});
