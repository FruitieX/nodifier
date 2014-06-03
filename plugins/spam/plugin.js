#!/usr/bin/env node

// spam plugin, useful for testing
var socket = require('../../lib/socketio-send.js');

var cnt = 0;
setInterval(function() {
	socket.send({
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
