#!/usr/bin/env node

var port = 5678;

// HTTP - socket.io bridge to enable applications supporting HTTP to interact with nodifier
var fs = require('fs');

var config = require(process.env.HOME + '/.nodifier/config.js');
var options = {
    tls: config.tls,
    key: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-key.pem'),
    cert: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    ca: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    rejectUnauthorized: config.rejectUnauthorized,
    requestCert: config.requestCert
};

var socket = require('socket.io-client')((config.tls ? 'https://' : 'http://') + config.host + ':' + config.port, options);

socket.on('connect', function() {
    console.log('HTTP server on port ' + port + ', bridging to node tls');
});

/*
var auth = require('http-auth');
var htpasswd = require('./htpasswd.json');
var basic = auth.basic({
    realm: "nodifier"
}, function (username, password, callback) {
    callback(username === htpasswd.username && password === htpasswd.password);
});
*/

var https = require('https');
var url = require('url');
var querystring = require('querystring');
var fs = require('fs');
var path = require('path');

var options = {
    key: fs.readFileSync(path.resolve(__dirname, './nodifier-httpbridge-key.pem')),
    cert: fs.readFileSync(path.resolve(__dirname, './nodifier-httpbridge-cert.pem'))
};

var handlePOST = function(req, res) {
    var msg, notifications;
    var queryData = url.parse(req.url, true).query;

    req.on('data', function(data) {
        var data_json = JSON.parse(data.toString('utf-8'));

        if (queryData.method === 'broadcast') {
            socket.emit('broadcast', data_json);
        } else if (queryData.method === 'newNotification') {
            delete(data_json.method);
            socket.emit('newNotification', data_json);
        } else if (queryData.method === 'setUnread') {
            socket.emit('markAs', {
                read: false,
                id: data_json.id,
                uid: data_json.uid,
                source: data_json.source,
                context: data_json.context
            });
        } else if (queryData.method === 'setRead') {
            socket.emit('markAs', {
                read: true,
                id: data_json.id,
                uid: data_json.uid,
                source: data_json.source,
                context: data_json.context
            });
        }
    });

    req.on('end', function() {
        res.writeHead(200, "OK", {
            'Content-Type': 'text/html',
            'Content-Length': Buffer.byteLength("OK", 'utf8')
        });
        res.end(msg);
    });
};

s = https.createServer(options, function (req, res) {
    if (req.method == 'POST') {
        handlePOST(req, res);
    }
});
s.listen(port);

process.on('uncaughtException', function (err) {
    console.error(err.stack);
    console.log("ERROR! Node not exiting.");
});

socket.on('error', function(e) {
    console.log('socket error: ' + e);
});
