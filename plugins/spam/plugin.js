#!/usr/bin/env node

// spam plugin, useful for testing
var post = require('../../lib/post.js');

var cnt = 0;
setInterval(function() {
	post.sendPOST({
		'method': 'newNotification',
		'text': 'spamäåö123' + cnt,
		'source': 'source' + cnt,
		'app': 'app' + cnt,
		'url': 'url' + cnt,
		'colorbg': 'red',
		'colorfg': 'white'
	});
	cnt++;
}, 1000);