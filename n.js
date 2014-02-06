#!/usr/bin/env node

var http = require('http');
var httpSync = require('http-sync');
var clc = require('cli-color');
var clc_color = require('./clc-color');

var id_color = clc.xterm(232).bgWhiteBright;
var def_source_color = clc.whiteBright.bgXterm(232);


function getUserHome() {
	return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

var requestNotification = function(id) {
	var config = require(getUserHome() + '/.nodeifier.json');

	config.path = "/" + id;
	config.method = "GET";

	var req = httpSync.request(config);

	var data = req.end();

	if(data.statusCode == 200) {
		var data_json = JSON.parse(data.body);

		var source_color = def_source_color;
		if(data_json.colorfg)
			source_color = clc_color.color_from_text(data_json.colorfg, data_json.colorbg);

		// pad with leading zeroes
		var pos_string = String(id);

		// if the string is wider than our terminal we need to shorten it
		var source_text_length = 5 + pos_string.length + data_json.source.length;
		var text_length = data_json.text.length;
		if(source_text_length + text_length > process.stdout.columns)
			data_json.text = data_json.text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

		console.log(id_color(' ' + pos_string + ' ') + source_color(' ' + data_json.source + ' ') + ' ' + data_json.text);
	} else {
		// do nothing
	}
};

if(process.argv[2]) {
	requestNotification(process.argv[2]);
} else { // get 50 previous notifications
	var config = require(getUserHome() + '/.nodeifier.json');

	config.path = "/getstate";
	config.method = "GET";

	var req = http.request(config, function(res) {
		res.on('data', function(data) {
			var data_json = JSON.parse(data);

			var i;
			var id = data_json.n_pos - config.num_notifications;
			if (id < 0)
				id += data_json.N_SIZE;

			for (i = id; i < id + config.num_notifications && i < data_json.N_SIZE; i++) {
				requestNotification(i);
			}

			// if we overflowed N_SIZE, take the rest from index 0 and up
			if (id + config.num_notifications >= data_json.N_SIZE) {
				for (i = 0; i < config.num_notifications - (data_json.N_SIZE - id); i++) {
					requestNotification(i);
				}
			}
		});
	});

	req.end();
}
