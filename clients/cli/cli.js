#!/usr/bin/env node

var clc = require('cli-color');
var clc_color = require('./lib/clc-color');

var config = require('../../config/config.json');

var open_re = /^(\d).*$|\.\./;
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

// print list of notifications, listenMode skips last \n, useReadID uses id of
// notification in read list instead of unread list
var printNotifications = function(notifications, listenMode, useReadID) {
	// listen mode should clear terminal
	if(listenMode)
		process.stdout.write('\u001B[2J\u001B[0;0f');

	if(notifications && notifications.length) {
		for(i = 0; i < notifications.length; i++) {
			var id = notifications[i].unreadID;
			if(useReadID)
				id = notifications[i].readID;

			printNotification(notifications[i], id, notifications.length !== 1);

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

// add notification to the notificationsCache array
var addNotification = function(notification) {
	// found duplicate ID? then remove the old notification
	if(notification.uid) {
		for (var i = notificationsCache.length - 1; i >= 0; i--) {
			if(notificationsCache[i].uid === notification.uid) {
				notificationsCache.splice(i, 1);
			}
		}
	}

	notificationsCache.push(notification);
	notificationsCache.sort(function(a, b) {
		return a.date - b.date;
	});
};

// update indices of notifications in notificationsCache
var updateID = function() {
	for (var i = 0; i < notificationsCache.length; i++) {
		notificationsCache[i].unreadID = i;
	}
};

// networking
var socket = require('socket.io-client')(config.host + ':' + config.port);

/* set up event handlers
 *
 * the commands in the Array() fetch a list of notifications from the server,
 * print the list once we receive it */

if(new Array('u', 'r', 'lr', undefined).indexOf(process.argv[2]) !== -1
	|| open_re.test(process.argv[2])) {

	socket.on('notifications', function(notifications) {
		printNotifications(notifications, false,
			(process.argv[2] === 'u' || process.argv[2] === 'lr'));

		// args match launching app
		if(open_re.test(process.argv[2]) && notifications) {
			for(var i = 0; i < notifications.length; i++) {
				launchProgram(notifications[i]);
			}
		}

		// non listen modes should exit now
		process.exit(0);
	});
} else if (process.argv[2] === 'l') {
	socket.on('notifications', function(notifications) {
		printNotifications(notifications, true, false);
		notificationsCache = notifications;
	});
	socket.on('markAs', function(notifications) {
		for (var i = notifications.length - 1; i >= 0; i--) {
			if (notifications[i].read) {
				// notification marked as read, remove
				notificationsCache.splice(notifications[i].unreadID, 1);
			} else {
				// new notification, add and sort
				addNotification(notifications[i]);
			}
		}
		updateID(); // indices may have changed, update them
		printNotifications(notificationsCache, true, false);
	});
	socket.on('newNotification', function(notification) {
		console.log(notification);
		// new notification, add and sort
		addNotification(notification);
		updateID(); // indices may have changed, update them
		printNotifications(notificationsCache, true, false);
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
		printNotifications(notificationsCache, true, false);
	});
}

// handle commands once connected to server
socket.on('connect', function() {
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
			// get all unread notifications once
			socket.emit('getUnread');
			break;

		default:
			if(open_re.test(process.argv[2])) {
				// open notification(s) with program
				socket.emit('markAs', {
					read: true,
					id: process.argv[2]
				});
			} else if (!process.argv[2]) {
				// requested all notifications
				socket.emit('getUnread');
			} else {
				console.log('unknown command!');
				process.exit(1);
			}
			break;
	}
});
