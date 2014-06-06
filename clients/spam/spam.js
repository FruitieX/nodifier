#!/usr/bin/env node

// spam plugin, useful for testing
var config = require('./../../config/config.js');
var socket = require('socket.io-client').connect(config.host + ':' + config.port, {
	query: {token: config.token}
});

var cnt = 0;
socket.on('connect', function() {
	setInterval(function() {
		socket.emit('newNotification', {
			'text': 'spamäåö123456789atheoutheachumcramcrhkrcehachuechacmecuaocemuchaechucehaocumechoaceuhcmkch.phehlowhwhell' + cnt,
			'source': 'source' + cnt,
			'sourcebg': 'red',
			'sourcefg': 'white',
			'context': 'context' + cnt,
			'contextbg': 'blue',
			'contextfg': 'white',
			'openwith': 'openwith' + cnt,
			'url': 'url' + cnt
		});
		cnt++;
	}, 200);
});
