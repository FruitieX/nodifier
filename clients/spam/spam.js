#!/usr/bin/env node

// spam plugin, useful for testing
var socketConnect = require('./../../lib/connect.js');
var socket = new socketConnect();

var cnt = 0;
socket.on('open', function() {
	setInterval(function() {
		socket.send('newNotification', {
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
