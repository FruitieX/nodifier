var tls = require('tls');
var config = require('./../config/config.js');

var fs = require('fs');
var options = {
	key: fs.readFileSync(__dirname + '/../config/nodifier-key.pem'),
	cert: fs.readFileSync(__dirname + '/../config/nodifier-cert.pem'),
	ca: fs.readFileSync(__dirname + '/../config/nodifier-cert.pem'),
	rejectUnauthorized: true
};

var socketConnect = function() {
	var socket = tls.connect(config.port, config.host, options, function() {
		socket.emit('open');
	});

	var recvBuffer = "";
	var incomingLength = 0;

	socket.on('data', function(data) {
		if(!incomingLength) {
			// first message is always the length
			incomingLength = data.toString();
		} else {
			recvBuffer += data.toString();

			// recv'd entire message
			if(recvBuffer.length >= incomingLength) {
				data = JSON.parse(recvBuffer);
				recvBuffer = "";
				incomingLength = 0;
				if(data[0] !== 'data')
					socket.emit(data[0], data[1]);
			}
		}
	});
	socket.send = function(evt, data) {
		data = JSON.stringify([evt, data]);
		socket.write(data.length);
		socket.write(data);
	};

	return socket;
}

module.exports = socketConnect;
