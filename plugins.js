#!/usr/bin/env node

/*
var gmail = require('./plugins/mail/plugin').start(
	// config file
	require('./plugins/mail/gmail.json')
);
*/

var email = require('./plugins/mail/plugin').start(
	// config file
	require('./plugins/mail/gmail.json')
);

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("Node NOT Exiting...");
});
