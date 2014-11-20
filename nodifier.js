#!/usr/bin/env node

var netEvent = require('net-event');
var config = require(process.env.HOME + '/.nodifier/config.js');
var fs = require('fs');
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;

MongoClient.connect(config.mongoURL, function(err, db) {
    assert.equal(null, err);
    var entries = db.collection('entries');

    // networking
    var options = {
        server: true,
        port: config.port,
        tls: config.tls,
        key: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-key.pem'),
        cert: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
        ca: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
        requestCert: config.requestCert,
        rejectUnauthorized: config.rejectUnauthorized
    };
    var server = new netEvent(options);

    server.on('open', function(socket) {
        // add/modify notification
        socket.on('set', function(entry) {
            // plugin did not provide timestamp, create one from current time
            if(!entry.date)
                entry.date = new Date().valueOf();

            entries.update({ _id: entry._id }, entry, { upsert: true },
            function(err, result) {
                if(!err && result) {
                    // broadcast new notification to all connected clients
                    socket.broadcast('set', entry);
                }

                // send update status back to caller
                socket.send('setStatus', [err, result]);
            });
        });

        // get notifications
        socket.on('get', function(data) {
            entries.find(data.query, data.options).toArray(function(err, results) {
                socket.send('set', [err, results]);
            });
        });

        socket.on('error', function(e) {
            console.log('\nsocket error: ' + e);
        });
        socket.setKeepAlive(true);
        socket.setNoDelay(true);
    });

    console.log('nodifier server listening on port ' + config.port);
});
