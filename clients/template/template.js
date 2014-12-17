#!/usr/bin/env node

// template client program
var netEvent = require('net-event');
var fs = require('fs');

var config = require(process.env.HOME + '/.nodifier/config.js');
var options = {
    host: config.host,
    port: config.port,
    tls: config.tls,
    key: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-key.pem'),
    cert: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    ca: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    rejectUnauthorized: config.rejectUnauthorized
};

var socket = new netEvent(options);

socket.on('open', function() {
    socket.send('set', {
        'text': 'notification text goes here',
        'category': 'todo',
        'app': 'testapp',
        'appbg': 'blue',
        'appfg': 'black',
        '_id': 'huehue#asdfs:aa' // TODO: use the hashing function
    });
});

socket.on('updateResults', function(data) {
    if(data.err)
        console.log(data.err);
    else {
        console.log('Entry added.');
        console.log(data.entries);
    }

    // now send a search query
    socket.send('search', {
        query: {},
        options: {
            sort: "category"
        }
    });
});

socket.on('searchResults', function(data) {
    if(data.err)
        console.log(data.err);
    else {
        console.log('Search results:');
        console.log(data.entries);
    }
    process.exit(0);
});

socket.on('error', function(e) {
    console.log('socket error: ' + e);
});
