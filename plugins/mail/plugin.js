var fs = require('fs');
var util = require('util');
var Imap = require('imap');
var inspect = require('util').inspect;
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var post = require('../../lib/post.js');
var url = require('url');
var path = require('path');

exports.start = function(config) {
	var imap;

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

	var unread = [];

	// new unread mail arrived
	var newUnread = function(from, subject, uid, threadId, labels, context, contextfg, contextbg) {
		var from_re = /(.*) <.*@.*>/;
		if(from.toString().match(from_re))
			from = from.toString().match(from_re)[1];

		var text = from + ': "' + subject + '"';

		var notification = {
			'method': 'newNotification',
			'uid': uid,
			'text': text,
			'openwith': config.openwith,
			'url': config.url + threadId,
			'source': config.source,
			'sourcebg': config.sourcebg,
			'sourcefg': config.sourcefg,
			'context': context,
			'contextbg': contextbg,
			'contextfg': contextfg,
			'response_host': config.response_host,
			'response_port': config.response_port
		};

		console.log('Sent new notification for unread mail UID: ' + uid);
		unread.push(uid);

		post.sendPOST(notification);
	};

	// notify server wants to mark mail as read
	var setRead = function(uid) {
		uid = parseInt(uid);
		imap.setFlags([uid], 'SEEN', function(err) {
			if(err) throw err;
			console.log("Set message with UID " + uid + " as read.");

			if(unread.indexOf(uid) !== -1) {
				unread.splice(unread.indexOf(uid), 1);
			} else {
				console.log("ERROR: Notify server tried to mark non existing UID as read!");
			}
		});
	};

	// notify server wants to mark mail as unread
	var setUnread = function(uid) {
		uid = parseInt(uid);
		imap.delFlags([uid], 'SEEN', function(err) {
			if(err) throw err;
			console.log("Set message with UID " + uid + " as unread.");

			if(unread.indexOf(uid) === -1) {
				unread.push(uid);
			} else {
				console.log("ERROR: Notify server tried to mark non existing UID as unread!");
			}
		});
	};

	/* fetch msgs and mark them as new notifications */
	var fetchAndNotify = function(msgs) {
		if(msgs.length) {
			var f = imap.fetch(msgs, { bodies: '' });
			f.on('message', function(msgs, seqno) {
				//var prefix = '(#' + seqno +') ';

				var from, subject, uid, threadId, labels, context, contextbg, contextfg;
				msgs.on('body', function(stream, info) {
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
				msgs.once('attributes', function(attrs) {
					uid = attrs.uid;
					threadId = dec2hex(attrs['x-gm-thrid']);
					labels = attrs['x-gm-labels'];
					console.log(labels);

					// attempt finding a "context" value for notification based on labels
					if(labels) {
						// loop over labels in mail
						for (var label in labels) {
							// loop over labels in config
							for (var cfglabel in config.label_contexts) {
								if(labels[label] === cfglabel) {
									context = config.label_contexts[cfglabel].context;
									contextfg = config.label_contexts[cfglabel].contextfg;
									contextbg = config.label_contexts[cfglabel].contextbg;
									break;
								}
							}
						}
					}
					if(!context) {
						context = config.label_contexts["default"].context;
						contextfg = config.label_contexts["default"].contextfg;
						contextbg = config.label_contexts["default"].contextbg;
					}
				});
				msgs.once('end', function() {
					newUnread(from, subject, uid, threadId, labels, context, contextfg, contextbg);
				});
			});
		}
	};

	/* Remove all previously seen UIDs from msgs */
	/*
	var removeOld = function(msgs) {
		for(var uid in unread) {
			var msg_index = msgs.indexOf(uid);
			if(msg_index === -1) {
				msgs.splice(msg_index, 1);
			}
		}
	};
	*/

	/*
	 * IMAP server state has changed, sync plugin and notify server accordingly
	 * Ran each time a new mail arrives and also at a set interval
	 * Interval due to gmail servers not sending updates for flag changes :(
	 */
	var syncFromIMAP = function() {
		imap.search(['UNSEEN'], function(err, results) {
			if(err) throw err;
			var i;

			// search for new unread mail
			// either unseen before or marked as read on notify server
			// (both of these require the mail notification be resent)
			var newUnread = [];
			for(i in results) {
				// found a mail not in our unread array
				if(unread.indexOf(results[i]) === -1) {
					newUnread.push(results[i]);
				}
			}
			fetchAndNotify(newUnread);

			// now do this vice-versa:
			// search for mails that we have marked as unread, but IMAP
			// server has marked as read. get rid of these notifications
			for(i = unread.length - 1; i >= 0; i--) {
				// found a mail not in the search results
				if(results.indexOf(unread[i]) === -1) {
					post.sendPOST({
						'method': 'setRead',
						'uid': unread[i],
						'noSendResponse': true
					});
					unread.splice(i, 1);
				}
			}
		});
	};

	var reconnectTimer;
	var reconnectLoop = function() {
		if(imap)
			imap.destroy();

		imap = new Imap({
			user: config.user,
			password: config.password,
			host: config.host,
			port: config.port,
			tls: config.tls,
			tlsOptions: { rejectUnauthorized: false },
			keepalive: true,
			debug: console.log
		});

		clearTimeout(reconnectTimer);
		reconnectTimer = setTimeout(reconnectLoop, 10000);

		imap.on('ready', function() {
			clearTimeout(reconnectTimer);
			imap.openBox('INBOX', false, function(err, box) {
				console.log('box opened.');

				imap.on('mail', function(numNewMsgs) {
					console.log('new mail ', inspect(numNewMsgs));
					syncFromIMAP();
				});

				imap.on('update', function(seqno, info) {
					console.log('update ', config.source, ' ', seqno);
				});

				imap.on('expunge', function(seqno) {
					console.log('expunge ', seqno);
				});

				setInterval(function() {
					syncFromIMAP();
				}, config.unreadSyncInterval * 1000);

				// initial sync
				syncFromIMAP();
			});
		});

		imap.on('error', function(err) {
			console.log(err);
			console.log('Error, reconnecting...');
			reconnectLoop();
		});

		imap.on('end', function() {
			console.log('Connection ended, reconnecting...');
			reconnectLoop();
		});

		imap.connect();
	};

	/* HTTP server for reporting read/unread statuses to plugin */
	var https = require('https');
	var auth = require('http-auth');
	var htpasswd = require('../../htpasswd.json');
	var basic = auth.basic({
		realm: "nodifier"
	}, function (username, password, callback) {
		callback(username === htpasswd.username && password === htpasswd.password);
	});

	var options = {
		key: fs.readFileSync(path.resolve(__dirname, config['mailplugin-ssl-key'])),
		cert: fs.readFileSync(path.resolve(__dirname, config['mailplugin-ssl-cert']))
	};

	s = https.createServer(basic, options, function (req, res) {
		handleGET(req, res);
	});

	s.listen(config.response_port);

	var url_read = /(.*read)\/(.*)/;
	var handleGET = function(req, res) {
		var resource = url.parse(req.url).pathname;
		resource = resource.substr(1);

		var url_matches = resource.match(url_read);

		var uid;
		if(url_matches[1] == 'read') {
			uid = url_matches[2];
			setRead(uid);
		} else if (url_matches[1] == 'unread') {
			uid = url_matches[2];
			setUnread(uid);
		}

		var msg = "ok";
		res.writeHead(200, msg, {
			'Content-Type': 'text/html',
			'Content-Length': Buffer.byteLength(msg, 'utf8')
		});
		res.end(msg);
	};

	reconnectLoop();
};
