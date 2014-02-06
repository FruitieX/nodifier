var fs = require('fs');
var util = require('util');
var ImapConnection = require('imap').ImapConnection;
var MailParser = require('mailparser').MailParser;
var Seq = require('seq');
var EventEmitter = require('events').EventEmitter;
var post = require('../post.js');

// most of the mail handling is done via a slightly modified version of
// the mail-notifier library by Jerome Creignou:
// https://github.com/jcreigno/nodejs-mail-notifier

exports.start = function(config) {
	function Notifier(opts) {
		EventEmitter.call(this);
		var self = this;
		self.options = opts;
		self.connected = false;
		self.imap = new ImapConnection({
			username: opts.username,
			password: opts.password,
			host: opts.host,
			port: opts.port,
			secure: opts.secure
		});
		self.imap.on('end',function(){
			self.connected = false;
			self.emit('end');
		});
		self.imap.on('error',function(err){
			self.emit('error', err);
		});
	}
	util.inherits(Notifier, EventEmitter);

	Notifier.prototype.start = function(){
		var self = this;
		Seq()
			.seq(function(){ self.imap.connect(this); })
			.seq(function(){
				self.connected = true;
				self.imap.openBox('INBOX',true,this);
			}).seq(function(){
				util.log('successfully opened mail box');
				self.imap.on('mail', function(id){ self.scan(); });
				self.scan();
			});
		return this;
	};

	Notifier.prototype.scan = function(){
		var self = this;
		Seq()
			.seq(function(){
				self.imap.search(['UNSEEN'],this);
			})
		.seq(function(searchResults){
			if(!searchResults || searchResults.length === 0){
				util.log('no new mail in INBOX');
				return;
			}
			var fetch = self.imap.fetch(searchResults,
				{
					request:{
						headers:false,
						body: "full"
					}
				});
			fetch.on('message', function(msg) {
				var mp = new MailParser();
				mp.on('end',function(mail){
					self.emit('mail',mail);
				});
				msg.on('data', function(chunk) {
					mp.write(chunk.toString());
				});
				msg.on('end', function() {
					mp.end();
				});
			});
			fetch.on('end', function() {
				util.log('Done fetching all messages!');
			});
		});
		return this;
	};

	Notifier.prototype.stop = function(){
		if(this.connected){
			this.imap.logout();
		}
		util.log('mail box closed.');
		return this;
	};

	var mailListener = new Notifier(config);

	mailListener.on('mail', function(mail) {
		var subject = mail.subject;
		var from = mail.headers.from;
		var text = "(no plaintext)";
		if(mail.text)
			text = mail.text.replace(/\n/g, ' ');

		// limit text length
		if(text.length > 110)
			text = text.substr(0, 110);

		post.sendPOST(from + ', "' + subject + '": ' + text, config.source, config.app, config.url, config.colorbg, config.colorfg);
	}).start();
};
