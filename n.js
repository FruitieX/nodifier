#!/usr/bin/env node

var http = require('http');

function getUserHome() {
	return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

var requestNotification = function(id) {
	var config = require(getUserHome() + '/.nodeifier.json');

	config.path = "/" + id;
	config.method = "GET";

	var req = http.request(config, function(res) {
		res.on('data', function(data) {
			console.log(id);
			console.log(JSON.parse(data).text);
		});
	});

	req.on('error', function(e) {
		console.log("Error: " + e.message);
	});

	req.end();
};

if(process.argv[2]) {
	requestNotification(process.argv[2]);
} else { // get 10 previous notifications
	var config = require(getUserHome() + '/.nodeifier.json');

	config.path = "/getstate";
	config.method = "GET";

	var req = http.request(config, function(res) {
		res.on('data', function(data) {
			var data_json = JSON.parse(data);

			var NUM_NOTIFICATIONS = 15;
			var i;
			var id = data_json.n_pos - NUM_NOTIFICATIONS + 1;
			if (id < 0)
				id += data_json.N_SIZE;
		console.log(id);

			for (i = id; i <= id + NUM_NOTIFICATIONS && i < data_json.N_SIZE; i++) {
				requestNotification(i);
			}

			if (id + NUM_NOTIFICATIONS >= data_json.N_SIZE) {
				for (i = 0; i < data_json.N_SIZE - id; i++) {
					requestNotification(i);
				}
			}
		});
	});

	req.end();
}
