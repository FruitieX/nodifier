var fs = require('fs');
var util = require('util');
var Imap = require('imap');
var inspect = require('util').inspect;
var MailParser = require('mailparser').MailParser;
var Seq = require('seq');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var post = require('../../lib/post.js');

// most of the mail handling is done via a slightly modified version of
// the mail-notifier library by Jerome Creignou:
// https://github.com/jcreigno/nodejs-mail-notifier

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

	var unread = {};

	// new unread mail arrived
	var newUnread = function(from, subject, uid, threadId, labels) {
		var text = from + ', Subject: "' + subject + '"';
		var hash = crypto.randomBytes(20).toString('hex');
		console.log(hash);

		unread[hash] = uid;

		post.sendPOST({
			'method': 'newNotification',
			'uid': hash,
			'text': text,
			'source': config.source,
			'app': config.app,
			'url': 'https://mail.google.com/mail/u/0/#inbox/' + threadId,
			'colorbg': config.colorbg,
			'colorfg': config.colorfg
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
		console.log('searching: ' + next_uid);
		imap.search(['UNSEEN', next_uid.toString() + ':*'], function(err, results) {
			console.log(results);
			if(err) throw err;
			if(results.length) {
				var f = imap.fetch(results, { bodies: '' });
				f.on('message', function(msg, seqno) {
					//console.log('Message #%d', seqno);
					//inspect(msg);
					console.log(msg);
					var prefix = '(#' + seqno +') ';

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
						console.log(prefix + 'Finished');
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
			/*
			if (err) throw err;
			var f = imap.seq.fetch('1:3', {
				bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
				struct: true
			});
			f.on('message', function(msg, seqno) {
				console.log('msg #%d', seqno);
				var prefix = '(#' + seqno + ') ';
				msg.on('body', function(stream, info) {
					var buffer = '';
					stream.on('data', function(chunk) {
						buffer += chunk.toString('utf8');
					});
					stream.once('end', function() {
						console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
					});
				});
				msg.once('attributes', function(attrs) {
					console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
				});
				msg.once('end', function() {
					console.log(prefix + 'Finished');
				});
			});
			f.once('error', function(err) {
				console.log('Fetch error: ' + err);
			});
			f.once('end', function() {
				console.log('Done fetching all messages!');
				imap.end();
			});
			*/
	});

	imap.once('error', function(err) {
		console.log(err);
	});

	imap.once('end', function() {
		console.log('Connection ended');
	});
	imap.connect();
};
			/*
			.seq(function(){ self.imap.connect(this); })
			.seq(function(){
				self.connected = true;
				self.imap.openBox('INBOX',true,this);
			}).seq(function(){
				util.log(config.source + ' - successfully opened mail box');
				self.imap.on('mail', function(id){ self.scan(); });
				self.imap.on('update', function(id) { console.log(id); });
				self.scan();
				if(!next_uid)
					next_uid = self.imap._state.box._uidnext;
			});
			*/

	/*
	Notifier.prototype.scan = function(){
		var self = this;
		Seq()
			.seq(function(){
				self.imap.search(['UNSEEN'],this);
			})
		.seq(function(searchResults){
			var i;

			// remove all messages up to next_uid
			for (i = 0; i < searchResults.length; i++) {
				if(searchResults[i] < next_uid) {
					searchResults.splice(i--, 1);
				}
			}

			// get maximum uid and set next_uid accordingly
			for (i = 0; i < searchResults.length; i++) {
				if(searchResults[i] >= next_uid)
					next_uid = searchResults[i] + 1;
			}

			if(!searchResults || searchResults.length === 0) {
				util.log(config.source + ' - no new mail in INBOX');
				return;
			} else {
				var fetch = self.imap.fetch(searchResults, {
					'bodies': 'HEADER.FIELDS (FROM TO SUBJECT DATE)'
				});
				fetch.on('message', function(msg) {
					var mp = new MailParser();
					mp.on('end',function(mail){
						self.emit('mail',mail);
					});
					msg.on('data', function(chunk) {
						console.log(chunk.toString());
						mp.write(chunk.toString());
					});
					msg.on('end', function() {
						mp.end();
					});
				});
				fetch.on('end', function() {
					util.log(config.source + ' - Done fetching all messages!');
				});
			}
		});
		return this;
	};

	Notifier.prototype.stop = function(){
		if(this.connected){
			this.imap.logout();
		}
		util.log(config.source + ' - mail box closed.');
		return this;
	};

	var setupListener = function(ml) {
		mailListener.on('end', function() { // reconnect
			mailListener.stop();
			mailListener = new Notifier(config);
			setupListener(mailListener);
		});

		mailListener.on('mail', function(mail) {
			var subject = mail.subject;
			var text = mail.headers.from + ', Subject: "' + subject + '"';
			util.log(config.source + ' - new mail: ' + text);
			post.sendPOST({
				'method': 'newNotification',
				'uid': config.source + mail.headers['message-id'],
				'text': text,
				'source': config.source,
				'app': config.app,
				'url': config.url,
				'colorbg': config.colorbg,
				'colorfg': config.colorfg
			});
		}).start();
	};

	var mailListener = new Notifier(config);

	setupListener(mailListener);
	*/
