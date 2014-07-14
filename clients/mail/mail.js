var util = require('util');
var Imap = require('imap');
var inspect = require('util').inspect;

var config = require('./../../config/config.js');
var mailConfig = require('./mailConfig.json');

var socketConnect = require('./../../lib/connect.js');
var socket = new socketConnect();

socket.on('markAs', function(notifications) {
    for (var i = notifications.length - 1; i >= 0; i--) {
        // TODO: more precise checking
        if(notifications[i].source === mailConfig.source) {
            if(notifications[i].read)
                setRead(notifications[i].uid);
            else
                setUnread(notifications[i].uid);
        }
    }
});

socket.once('open', function() {
    reconnectLoop();
});

var imap;

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
    if(from && from.toString().match(from_re))
        from = from.toString().match(from_re)[1];

    var text = from + ': "' + subject + '"';

    var notification = {
        'method': 'newNotification',
        'uid': uid,
        'text': text,
        'openwith': mailConfig.openwith,
        'url': mailConfig.url + threadId,
        'source': mailConfig.source,
        'sourcebg': mailConfig.sourcebg,
        'sourcefg': mailConfig.sourcefg,
        'context': context,
        'contextbg': contextbg,
        'contextfg': contextfg,
        'response_host': mailConfig.response_host,
        'response_port': mailConfig.response_port
    };

    console.log('Sent new notification for unread mail UID: ' + uid);
    unread.push(uid);

    socket.send('newNotification', notification);
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
                        for (var cfglabel in mailConfig.label_contexts) {
                            if(labels[label] === cfglabel) {
                                context = mailConfig.label_contexts[cfglabel].context;
                                contextfg = mailConfig.label_contexts[cfglabel].contextfg;
                                contextbg = mailConfig.label_contexts[cfglabel].contextbg;
                                break;
                            }
                        }
                    }
                }
                if(!context) {
                    context = mailConfig.label_contexts["default"].context;
                    contextfg = mailConfig.label_contexts["default"].contextfg;
                    contextbg = mailConfig.label_contexts["default"].contextbg;
                }
            });
            msgs.once('end', function() {
                newUnread(from, subject, uid, threadId, labels, context, contextfg, contextbg);
            });
        });
    }
};

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
                socket.send('markAs', {
                    'read': true,
                    'uid': unread[i],
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
        user: mailConfig.user,
        password: mailConfig.password,
        host: mailConfig.host,
        port: mailConfig.port,
        tls: mailConfig.tls,
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
                console.log('update ', mailConfig.source, ' ', seqno);
            });

            imap.on('expunge', function(seqno) {
                console.log('expunge ', seqno);
            });

            setInterval(function() {
                syncFromIMAP();
            }, mailConfig.unreadSyncInterval * 1000);

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

process.on('uncaughtException', function (err) {
    console.log("ERROR: " + err);
    reconnectLoop();
});
