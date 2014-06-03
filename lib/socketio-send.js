var config = require('../config.json');
var socket = require('socket.io-client')(config.host + ':' + config.port);

exports.send = function(data, silent) {
	socket.on('connect', function() {
		socket.emit('newNotification', data);
	});
};
