#!/usr/bin/env node
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var clc = require('cli-color');
var clc_color = require('./clc-color');

var PORT = 8888;
if(process.argv[2]) {
	PORT = process.argv[2];
}

var n = [];

var id_color = clc.xterm(232).bgWhiteBright;
var def_app_color = clc.whiteBright.bgXterm(232);

// append notification to array
var n_append = function(data) {
	n.push({
		'text': data.text,
		'app': data.app,
		'colorbg': data.color,
		'colorfg': data.colorbg,
		'colorbg_id': data.color_id,
		'colorfg_id': data.colorbg_id,
		'url': data.url
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

			var app_color = def_app_color;
			if(data_json.colorfg)
				app_color = clc_color.color_from_text(data_json.colorfg, data_json.colorbg);

			console.log(id_color(' 42 ') + app_color(' ' + data_json.app + ' ') + ' ' + data_json.text);

			n_append(data_json);
			// TODO: also store in sqlite3 db
		});

		req.on('end', function() {
			res.writeHead(200, "OK", {'Content-Type': 'text/html'});
			res.end();
		});
	} else {
		var resource = url.parse(req.url).pathname;
		resource = resource.substr(1);

		if(n[resource]) {
			res.writeHead(200, "OK", {'Content-Type': 'text/html'});
			res.end(n[resource].url);
		} else {
			res.writeHead(404, "Not found.", {'Content-Type': 'text/html'});
			res.end("");
		}
	}
});

process.stdout.write('\u001B[2J\u001B[0;0f');
console.log(clc.green('listening on port ' + PORT));
s.listen(PORT);
