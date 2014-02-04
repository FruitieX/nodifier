var http = require('http');
var querystring = require('querystring');
var config = require('../config.json');

exports.sendPOST = function(text, source, app, url, colorbg, colorfg, colorbg_id, colorfg_id) {
	post_data = querystring.stringify({
		'text': text,
		'source': source,
		'app': app,
		'url': url,
		'colorbg': colorbg,
		'colorfg': colorfg,
		'colorbg_id': colorbg_id,
		'colorfg_id': colorfg_id
	});

	post_opts = {
		host: config.host,
		port: config.port,
		path: '/',
		method: 'POST',
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
