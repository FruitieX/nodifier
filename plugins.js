var gmail = require('./plugins/mail/plugin').start(
	// config file
	require('./plugins/mail/gmail.json')
);

var email = require('./plugins/mail/plugin').start(
	// config file
	require('./plugins/mail/email.json')
);
