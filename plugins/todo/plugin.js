#!/usr/bin/env node

// todo plugin for quick adding of todos
var post = require('../../lib/post.js');

if(!process.argv[2]) {
	console.log("Usage: todo [message]");
	process.exit(1);
}

var str = "";
for (var i = 2; i < process.argv.length; i++) {
	str += process.argv[i] + ' ';
}
str.substring(0, str.length - 1);

post.sendPOST({
	'method': 'newNotification',
	'text': str,
	'source': 'todo',
	'sourcebg': 'blue',
	'sourcefg': 'black'
});
