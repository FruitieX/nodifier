var tls = require('tls');
var config = require('./../config/config.js');

var fs = require('fs');
var options = {
	key: fs.readFileSync(__dirname + '/../config/nodifier-key.pem'),
	cert: fs.readFileSync(__dirname + '/../config/nodifier-cert.pem'),
	ca: fs.readFileSync(__dirname + '/../config/nodifier-cert.pem'),
	rejectUnauthorized: true
};

var socket = tls.connect(config.port, config.host, options, function() {
	socket.emit('open');
});

socket.on('data', function(data) {
	data = JSON.parse(data.toString());
	if(data[0] !== 'data')
		socket.emit(data[0], data[1]);
});
socket.send = function(evt, data) {
	socket.write(JSON.stringify([evt, data]));
};

module.exports = socket;
