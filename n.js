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
			console.log(JSON.parse(data));
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
			console.log(JSON.parse(data));
			for (var i = 0; i < 10; i++) {
				requestNotification(i);
			}
		});
	});

	req.end();
}
