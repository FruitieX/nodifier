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

    /* TODO: let clients know about this, or write the spec so that done is considered deleted */
    // cleanup old entries marked as "done"
    var cleanOldEntries = function() {
        entries.remove({
            "$and": [
                { lastModified: { "$lte": new Date().getTime() - config.expiryTime } },
                { category: config.categories[config.categories.length - 1] }
            ]
        }, function(err, cnt) {
            console.log("cleaned up " + cnt + " expired entries.");
        });
    };
    cleanOldEntries();
    setInterval(cleanOldEntries, config.expiryCheckInterval);

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
        socket.on('set', function(entry) {
            entry.lastModified = new Date().getTime();

            if(entry._id) {
                // modify existing entry
                var id = entry._id;
                // id has to be removed before findAndModify(), else mongo complains
                delete(entry._id);
                entries.findAndModify(
                    { _id: ObjectID(id) }, [['_id', 'asc']], entry, { new: true, upsert: true},
                    function(err) {
                        // re-add entry when sending back to client
                        entry._id = id;
                        socket.send('updateResults', {err: err, entries: [entry]});
                        socket.broadcast('update', {err: err, entries: [entry]}, true);
                    }
                );
            } else {
                // add new entry
                entries.insert(
                    entry,
                    function(err, doc) {
                        socket.send('updateResults', {err: err, entries: doc});
                        socket.broadcast('update', {err: err, entries: doc}, true);
                    }
                );
            }
        });

        socket.on('search', function(data) {
            // get notifications
            entries.find(data.query, data.options).toArray(function(err, docs) {
                socket.send('searchResults', {query: data.query, err: err, entries: docs});
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
