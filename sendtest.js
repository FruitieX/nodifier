var http = require('http');
var querystring = require('querystring');

post_data = querystring.stringify({
	'text': 'hello world!',
	'app': 'gmail',
	'colorbg': 'red',
    'colorfg': 'whiteBright',
	//'colorbg_id': '',
	//'colorfg_id': '',
	'url': 'http://localhost:8888'
});


post_opts = {
	host: 'localhost',
	port: '8888',
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
