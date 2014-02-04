#!/usr/bin/env node
var http = require('http');
var querystring = require('querystring');
var terminal = require('node-terminal');

var PORT = 8888;
if(process.argv[2]) {
	PORT = process.argv[2];
}

var n = [];

// append notification to array
var n_append = function(text, app, color, url) {
	n.push({
		'text': text,
		'app': app,
		'color': color,
		'url': url
	});

	// remove from beginning of array if it starts to grow big
	if(n.length > 30) {
		n.splice(0, 1);
	}
};

s = http.createServer(function (req, res) {
	if (req.method == 'POST') {
		req.on('data', function(data) {
			var data_json = querystring.parse(data.toString());

			terminal.color('white').write('[');
			terminal.color(data_json.color).write(data_json.app);
			terminal.color('white').write('] ');
			terminal.color('white').write(data_json.text + '\n');

			n_append(data_json.text, data_json.app, data_json.color, data_json.url);
			// TODO: also store in sqlite3 db
		});

		req.on('end', function() {
			// empty 200 OK response for now
			res.writeHead(200, "OK", {'Content-Type': 'text/html'});
			res.end();
		});
	} else {
		res.writeHead(405, "only POST method supported", {'Content-Type': 'text/html'});
		res.end('405 - only POST method supported');
	}
});

terminal.color('green').write('listening on port ' + PORT + '\n');
s.listen(PORT);
