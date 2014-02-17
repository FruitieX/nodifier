var http = require('http');
var querystring = require('querystring');
var config = require('../cfg/config_sv.json');
var htpasswd = require('../cfg/htpasswd.json');

exports.sendPOST = function(data) {
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
			console.log('Response: ' + chunk);
		});
	});

	post_req.write(post_data);
	post_req.end();
};
