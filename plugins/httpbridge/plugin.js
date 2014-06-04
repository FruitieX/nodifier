#!/usr/bin/env node

var port = 5678;

// HTTP - socket.io bridge to enable applications supporting HTTP to interact with nodifier
var config = require('../../config.json');
var socket = require('socket.io-client')(config.host + ':' + config.port);

var auth = require('http-auth');
var htpasswd = require('./htpasswd.json');
var basic = auth.basic({
	realm: "nodifier"
}, function (username, password, callback) {
	callback(username === htpasswd.username && password === htpasswd.password);
});

var https = require('https');
var url = require('url');
var querystring = require('querystring');
var fs = require('fs');
var path = require('path');

var options = {
	key: fs.readFileSync(path.resolve(__dirname, './nodifier-key.pem')),
	cert: fs.readFileSync(path.resolve(__dirname, './nodifier-cert.pem'))
};

socket.on('connect', function() {
	var handlePOST = function(req, res) {
		var msg, notifications;

		req.on('data', function(data) {
			var data_json = querystring.parse(data.toString());

			if (data_json.method === 'newNotification') {
				delete(data_json.method);
				socket.emit('newNotification', data_json);
			} else if (data_json.method === 'setUnread') {
				socket.emit('markAs', {
					read: false,
					id: data_json.id,
					uid: data_json.uid,
					source: data_json.source,
					context: data_json.context
				});
			} else if (data_json.method === 'setRead') {
				socket.emit('markAs', {
					read: true,
					id: data_json.id,
					uid: data_json.uid,
					source: data_json.source,
					context: data_json.context
				});
			}
		});

		req.on('end', function() {
			res.writeHead(200, "OK", {
				'Content-Type': 'text/html',
				'Content-Length': Buffer.byteLength("OK", 'utf8')
			});
			res.end(msg);
		});
	};

	s = https.createServer(basic, options, function (req, res) {
		if (req.method == 'POST') {
			handlePOST(req, res);
		}
	});
	console.log('HTTP server on port ' + port + ', bridging to socket.io');
	s.listen(port);
});
