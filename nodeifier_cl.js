#!/usr/bin/env node

var http = require('http');
var clc = require('cli-color');
var clc_color = require('./lib/clc-color');

var id_color = clc.xterm(232).bgWhiteBright;
var def_source_color = clc.whiteBright.bgXterm(232);

var config = require('./cfg/config_cl.json');
var htpasswd = require('./cfg/htpasswd.json');

var get_n = process.argv[2];
var path;
if (get_n)
	path = '/' + get_n;
else
	path = '/getprev/' + config.num_notifications;

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

	// pad with leading zeroes
	var pos_string = String(id);

	// if the string is wider than our terminal we need to shorten it
	var source_text_length = 5 + pos_string.length + notification.source.length;
	var text_length = notification.text.length;
	if(source_text_length + text_length > process.stdout.columns)
		notification.text = notification.text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

	console.log(id_color(' ' + pos_string + ' ') + source_color(' ' + notification.source + ' ') + ' ' + notification.text);
};

var req = http.request(options, function(res) {
	res.on('data', function(data) {
		var json_data = JSON.parse(data);

		if (get_n) // requested only a specific notification
			printNotification(json_data);
		else // got an array of notifications
			for (var notification in json_data)
				printNotification(notification);
	});
});

req.end();
