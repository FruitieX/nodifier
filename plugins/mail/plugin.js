var fs = require('fs');
var util = require('util');
var Imap = require('imap');
var inspect = require('util').inspect;
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var post = require('../../lib/post.js');
var url = require('url');

exports.start = function(config) {
	var imap = new Imap({
		user: config.user,
		password: config.password,
		host: config.host,
		port: config.port,
		tls: config.tls,
		tlsOptions: { rejectUnauthorized: false },
		keepalive: true,
		//debug: console.log
	});

	function dec2hex(str) { // .toString(16) only works up to 2^53
		var dec = str.toString().split(''), sum = [], hex = [], i, s;

		while(dec.length) {
			s = 1 * dec.shift();
			for(i = 0; s || i < sum.length; i++) {
				s += (sum[i] || 0) * 10;
				sum[i] = s % 16;
				s = (s - sum[i]) / 16;
			}
		}

		while(sum.length) {
			hex.push(sum.pop().toString(16));
		}

		return hex.join('');
	}

	var unread = {};
	var read = {};

	// new unread mail arrived
	var newUnread = function(from, subject, uid, threadId, labels) {
		var text = from + ', Subject: "' + subject + '"';
		var hash = crypto.randomBytes(20).toString('hex');

		unread[hash] = uid;

		post.sendPOST({
			'method': 'newNotification',
			'uid': hash,
			'text': text,
			'source': config.source,
			'app': config.app,
			'url': config.url + threadId,
			'colorbg': config.colorbg,
			'colorfg': config.colorfg,
			'response_host': config.response_host,
			'response_port': config.response_port
		});
	};

	// mark mail as read, then forget about it
	var setRead = function(hash) {
		var uid = unread[hash];
		if(uid) {
			imap.setFlags([uid], 'SEEN', function(err) {
				if(err) throw err;
				console.log("Set message with UID " + uid + " as read.");
				read[hash] = unread[hash];
				delete unread[hash];
			});
		}
	};

	// mark mail as unread
	var setUnread = function(hash) {
		var uid = read[hash];
		if(uid) {
			imap.delFlags([uid], 'SEEN', function(err) {
				if(err) throw err;
				console.log("Set message with UID " + uid + " as unread.");
				unread[hash] = read[hash];
				delete read[hash];
			});
		}
	};

	/* Sync (un)read message statuses with IMAP server
	 * Because gmail servers don't push updates :(
	 */
	var syncUnread = function() {
		imap.search(['UNSEEN'], function(err, imap_unread) {
			if(err) throw err;
			//console.log('syncresults: ' + results);
			for(var hash in unread) {
				// currently only handle marking as read, marking as
				// unread is hard because we might have deleted a
				// notification on the server! TODO
				if(imap_unread.indexOf(unread[hash]) === -1) {
					post.sendPOST({
						'method': 'setRead',
						'uid': hash,
						'noSendResponse': true
					});
					read[hash] = unread[hash];
					delete unread[hash];
				}
			}
		});
	};

	/* Searches for new messages from next_uid:*
	 * Updates next_uid if new messages were found */

	var next_uid = 1;
	var searchNew = function(firstrun) {
		imap.search(['UNSEEN', next_uid.toString() + ':*'], function(err, results) {
			if(err) throw err;
			if(results.length) {
				var f = imap.fetch(results, { bodies: '' });
				f.on('message', function(msg, seqno) {
					//var prefix = '(#' + seqno +') ';

					var from, subject, uid, threadId, labels;
					msg.on('body', function(stream, info) {
						var buffer = '';
						stream.on('data', function(chunk) {
							buffer += chunk.toString('utf8');
						});
						stream.on('end', function() {
							var header = Imap.parseHeader(buffer);
							from = header.from;
							subject = header.subject;
						});
					});
					msg.once('attributes', function(attrs) {
						if(attrs.uid >= next_uid)
							next_uid = attrs.uid + 1;
						uid = attrs.uid;
						threadId = dec2hex(attrs['x-gm-thrid']);
						labels = attrs['x-gm-labels'];
					});
					msg.once('end', function() {
						newUnread(from, subject, uid, threadId, labels);
					});
				});
			}
		});
	};

	imap.once('ready', function() {
		imap.openBox('INBOX', false, function(err, box) {
			console.log('box opened.');
			next_uid = box.uidnext;

			imap.on('mail', function(numNewMsgs) {
				console.log('new mail ', inspect(numNewMsgs));
				searchNew(imap);
			});

			imap.on('update', function(seqno, info) {
				console.log('update ', config.source, ' ', seqno);
			});

			imap.on('expunge', function(seqno) {
				console.log('expunge ', seqno);
			});

			setInterval(function() {
				syncUnread();
			}, config.unreadSyncInterval * 1000);
		});
	});

	imap.once('error', function(err) {
		console.log(err);
	});

	imap.once('end', function() {
		console.log('Connection ended');
	});
	imap.connect();

	var url_read = /(.*read)\/(.*)/;
	var handleGET = function(req, res) {
		var resource = url.parse(req.url).pathname;
		resource = resource.substr(1);

		var url_matches = resource.match(url_read);

		var hash;
		if(url_matches[1] == 'read') {
			hash = url_matches[2];
			setRead(hash);
		} else if (url_matches[1] == 'unread') {
			hash = url_matches[2];
			setUnread(hash);
		}

		var msg = "ok";
		res.writeHead(200, msg, {
			'Content-Type': 'text/html',
			'Content-Length': Buffer.byteLength(msg, 'utf8')
		});
		res.end(msg);
	};

	/* HTTP server for reporting read/unread statuses to plugin */
	var http = require('http');
	var auth = require('http-auth');
	var htpasswd = require('./../../htpasswd.json');
	var basic = auth.basic({
		realm: "nodifier"
	}, function (username, password, callback) {
		callback(username === htpasswd.username && password === htpasswd.password);
	});

	s = http.createServer(basic, function (req, res) {
		handleGET(req, res);
	});
	s.listen(config.response_port);
};
