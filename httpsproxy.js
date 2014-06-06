var config = require('./config/config.js');

require('http-proxy').createServer({
	target: {
		host: 'localhost',
		port: config.listenPort
	},
	ssl: {
		key: require('fs').readFileSync('config/nodifier-key.pem', 'utf8'),
		cert: require('fs').readFileSync('config/nodifier-cert.pem', 'utf8')
	},
	ws: true
}).listen(config.httpsProxyPort);

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	console.log("ERROR! Node not exiting.");
});
