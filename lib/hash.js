var crypto = require('crypto');
var shasum = crypto.createHash('sha');

exports.hash = function(notification) {
	shasum.update(notification.text + notification.source + notification.date);
	return shasum.digest('hex');
};
