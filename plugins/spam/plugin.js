var post = require('../post.js');

var cnt = 0;
setInterval(function() {
	post.sendPOST('spam' + cnt, 'source' + cnt, 'app' + cnt, 'url' + cnt, 'red', 'white');
	cnt++;
}, 1000);
