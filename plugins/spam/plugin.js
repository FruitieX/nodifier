#!/usr/bin/env node

// spam plugin, useful for testing
var config = require('../../config.json');
var socket = require('socket.io-client')(config.host + ':' + config.port);

var cnt = 0;
socket.on('connect', function() {
	setInterval(function() {
		socket.emit('newNotification', {
			'method': 'newNotification',
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
