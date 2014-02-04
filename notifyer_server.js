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

s = http.createServer(function (req, res) {
	if (req.method == 'POST') {
		req.on('data', function(data) {
			var data_json = querystring.parse(data.toString());

			var source_color = def_source_color;
			if(data_json.colorfg)
				source_color = clc_color.color_from_text(data_json.colorfg, data_json.colorbg);

			// pad with leading zeroes
			var leading_zeros = '';
			for(var i = 0; i < N_LENGTH - 1; i++) {
				leading_zeros += '0';
			}
			var pos_string = String(leading_zeros + n_pos).slice(N_LENGTH * -1);

			console.log(id_color(' ' + pos_string + ' ') + source_color(' ' + data_json.source + ' ') + ' ' + data_json.text);

			n_append(data_json);
			// TODO: also store in sqlite3 db?
		});

		req.on('end', function() {
			res.writeHead(200, "OK", {'Content-Type': 'text/html'});
			res.end();
		});
	} else {
		var resource = url.parse(req.url).pathname;
		resource = resource.substr(1);

		notification = n_fetch(resource);

		if(notification) {
			res.writeHead(200, "OK", {'Content-Type': 'text/html'});
			res.end(JSON.stringify(notification));
		} else {
			res.writeHead(404, "Not found.", {'Content-Type': 'text/html'});
			res.end("");
		}
	}
});

process.stdout.write('\u001B[2J\u001B[0;0f');
console.log(clc.green('listening on port ' + PORT));
s.listen(PORT);
