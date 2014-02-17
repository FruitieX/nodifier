var http = require('http');
var querystring = require('querystring');
var config = require('../config.json');
var htpasswd = require('../htpasswd.json');

exports.sendPOST = function(data, silent) {
	post_data = querystring.stringify(data);

	post_opts = {
		host: config.host,
		port: config.port,
		path: '/',
		method: 'POST',
		auth: htpasswd.username + ':' + htpasswd.password,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': post_data.length
		}
	};

	post_req = http.request(post_opts, function(res) {
		res.setEncoding('utf8');

		res.on('data', function (chunk) {
			if(!silent) {
				console.log('Response: ' + chunk);
			}
		});
	});

	post_req.write(post_data);
	post_req.end();
};