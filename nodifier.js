#!/usr/bin/env node

var netEvent = require('net-event');
var config = require(process.env.HOME + '/.nodifier/config.js');
var fs = require('fs');
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

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
            if(entry._id) {
                var id = entry._id;
                delete(entry._id);
                entries.findAndModify(
                    { _id: ObjectID(id) }, [['_id', 'asc']], entry, { new: true, upsert: true},
                    function(err) {
                        socket.broadcast('set', {err: err, entries: [entry]});
                    }
                );
            } else {
                entries.insert(
                    entry,
                    function(err, doc) {
                        socket.broadcast('set', {err: err, entries: [doc]});
                    }
                );
            }
        });

        // get notifications
        socket.on('get', function(data) {
            entries.find(data.query, data.options).toArray(function(err, docs) {
                socket.send('set', {err: err, entries: docs});
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
