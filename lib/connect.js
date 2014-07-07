var tls = require('tls');
var config = require('./../config/config.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var fs = require('fs');
var options = {
    key: fs.readFileSync(__dirname + '/../config/nodifier-key.pem'),
    cert: fs.readFileSync(__dirname + '/../config/nodifier-cert.pem'),
    ca: fs.readFileSync(__dirname + '/../config/nodifier-cert.pem'),
    rejectUnauthorized: true
};

var socketConnect = function() {
    var recvBuffer = "";
    var incomingLength = 0;

    var self = this;
    var socket;

    var reconnectTimeout;
    var connect = function(callback) {
        socket = tls.connect(config.port, config.host, options, function() {
            socket.on('data', function(data) {
                if(!incomingLength) {
                    // first message is always the length
                    incomingLength = data.toString();
                } else {
                    recvBuffer += data.toString();

                    // recv'd entire message
                    if(recvBuffer.length >= incomingLength) {
                        data = JSON.parse(recvBuffer);
                        recvBuffer = "";
                        incomingLength = 0;
                        if(data[0] !== 'data')
                            self.emit(data[0], data[1]);
                    }
                }
            });

            self.emit('open');
        });

        var reconnect = function(e) {
            if(!e)
                e = '';
            console.log('DEBUG: Reconnecting... ' + e);
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connect, 1000);
        };

        socket.once('close', function() {
            reconnect();
        });
        socket.once('error', function(e) {
            reconnect(e);
        });

        socket.setKeepAlive(true);
    };

    connect();

    this.send = function(evt, data) {
        data = JSON.stringify([evt, data]);
        socket.write(data.length.toString());
        socket.write(data);
    };
    this.close = function() {
        socket.removeAllListeners('close');
        socket.end();
    };
}

util.inherits(socketConnect, EventEmitter);

module.exports = socketConnect;
