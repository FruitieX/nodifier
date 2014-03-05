var fs = require('fs');
var util = require('util');
var Imap = require('imap');
var inspect = require('util').inspect;
var MailParser = require('mailparser').MailParser;
var Seq = require('seq');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var post = require('../../lib/post.js');

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
			'url': 'https://mail.google.com/mail/u/0/#inbox/' + threadId,
			'colorbg': config.colorbg,
			'colorfg': config.colorfg,
			'response_host': config.response_host,
			'response_port': config.response_port
		});
	};

	// mark mail as read, then forget about it
	var setRead = function(hash) {
		var uid = unread[hash];
		imap.setFlags([uid], function() {
			console.log("Set message with UID " + uid + " as read.");
			delete unread[hash];
		});
	};

	/* Searches for new messages from next_uid:*
	 * Updates next_uid if new messages were found */

	var next_uid = 1;
	var searchUnseen = function(firstrun) {
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
		imap.openBox('INBOX', true, function(err, box) {
			console.log('box opened.');
			next_uid = box.uidnext;

			imap.on('mail', function(numNewMsgs) {
				console.log('new mail ', inspect(numNewMsgs));
				searchUnseen(imap);
			});

			imap.on('update', function(seqno, info) {
				console.log('update ', config.source, ' ', seqno);
			});

			imap.on('expunge', function(seqno) {
				console.log('expunge ', seqno);
			});
		});
	});

	imap.once('error', function(err) {
		console.log(err);
	});

	imap.once('end', function() {
		console.log('Connection ended');
	});
	imap.connect();
};
