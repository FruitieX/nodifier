var WebSocket = require('ws');
var config = require('./../config/config.js');

var socket = new WebSocket(config.host + ':' + config.port);
socket.eventSend = function(event, data) {
	var packet = {
		'event': event,
		'data': data
	};
	packet = JSON.stringify(packet)
	this.send(packet, {binary: true, mask: true});
};

socket.on('message', function(packet) {
	packet = JSON.parse(packet);
	if(packet.event)
		socket.emit(packet.event, packet.data);
	else
		console.log("ERROR: no event in received data! " + packet);
});

socket.on('open', function() {
	// TODO: do auth here
	socket.emit('auth');
});

module.exports = socket;
