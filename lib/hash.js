var crypto = require('crypto');
var shasum = crypto.createHash('sha');

exports.digest = function(data) {
	shasum.update(data);
	return shasum.digest('hex');
};
