require('http-proxy').createServer({
	target: {
		host: 'localhost',
		port: 8888
	},
	ssl: {
		key: require('fs').readFileSync('config/nodifier-key.pem', 'utf8'),
		cert: require('fs').readFileSync('config/nodifier-cert.pem', 'utf8')
	}
}).listen(7777);
