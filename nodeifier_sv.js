#!/usr/bin/env node

var auth = require('http-auth');
var htpasswd = require('./htpasswd.json');
var basic = auth.basic({
	realm: "nodeifier"
}, function (username, password, callback) {
	callback(username === htpasswd.username && password === htpasswd.password);
});

var http = require('http');
var url = require('url');
var querystring = require('querystring');
var clc = require('cli-color');
var clc_color = require('./lib/clc-color');
var config = require('./config_sv');

var id_color = clc.xterm(232).bgWhiteBright;
var def_source_color = clc.whiteBright.bgXterm(232);

// array containing notifications (as JSON)
var n = [];
var N_SIZE = 1000;
// max length (in chars) of the n_pos number, log base conversion needed
var N_LENGTH = Math.ceil(Math.log(N_SIZE) / Math.log(10));
var n_pos = 0;

// put notification to array at pos n_pos and increment n_pos
var n_append = function(data) {
	n[n_pos++] = data;

	// wrap n_pos to the beginning of the array if it starts growing big
	if(n_pos >= N_SIZE) {
		n_pos = 0;
	}
};

var n_fetch = function(pos) {
	pos = parseInt(pos, 10); // remove leading zeros

	return n[pos];
};

s = http.createServer(basic, function (req, res) {
	if (req.method == 'POST') {
		req.on('data', function(data) {
			var data_json = querystring.parse(data.toString());

			var source_color = def_source_color;
			if(data_json.colorfg)
				source_color = clc_color.color_from_text(data_json.colorfg, data_json.colorbg);

			// pad with leading zeroes
			var leading_zeros = '';
			for(var i = 0; i < N_LENGTH - 1; i++)
				leading_zeros += '0';
			var pos_string = String(leading_zeros + n_pos).slice(N_LENGTH * -1);

			// store POST in notifications array
			n_append(data_json);

			// if the string is wider than our terminal we need to shorten it
			var source_text_length = 5 + pos_string.length + data_json.source.length;
			var text_length = data_json.text.length;
			if(source_text_length + text_length > process.stdout.columns)
				data_json.text = data_json.text.substr(0, process.stdout.columns - source_text_length - 3) + '...';

			console.log(id_color(' ' + pos_string + ' ') + source_color(' ' + data_json.source + ' ') + ' ' + data_json.text);
		});

		req.on('end', function() {
			res.writeHead(200, "OK", {'Content-Type': 'text/html'});
			res.end();
		});
	} else {
		var resource = url.parse(req.url).pathname;
		resource = resource.substr(1);

		if(resource === "getstate") {
			res.writeHead(200, "OK", {'Content-Type': 'text/html'});
			res.end(JSON.stringify({
				'n_pos': n_pos,
				'N_SIZE': N_SIZE
			}));
		}
		else {
			notification = n_fetch(resource);

			if(notification) {
				res.writeHead(200, "OK", {'Content-Type': 'text/html'});
				res.end(JSON.stringify(notification));
			} else {
				res.writeHead(404, "Not found.", {'Content-Type': 'text/html'});
				res.end("No notification matching ID!");
			}
		}
	}
});

process.stdout.write('\u001B[2J\u001B[0;0f');
console.log(clc.green('listening on port ' + config.port));
s.listen(config.port);
