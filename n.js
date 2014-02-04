var http = require('http');
var terminal = require('node-terminal');

PORT = 8888;

n = [];

// append notification to array
var n_append = function(text, app, color, url) {
	n.push({
		'text': text,
		'app': app,
		'color': color,
		'url': url
	});

	// remove from beginning of array if it starts to grow big
	if(n.length() > 30) {
		n.splice(0, 1);
	}
};

s = http.createServer(function (req, res) {
	if (req.method == 'POST') {
		req.on('data', function(data) {
			var text = data.toString();

			terminal.colorize('%rR%ma%ci%bn%yb%go%rw\n');
			//console.log('[' + app + '] ' + text);

			//n_append(text, app, color, url);
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

s.listen(PORT);
