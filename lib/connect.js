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

    var self = this;
    var socket;

    var reconnectTimeout;
    var connect = function(callback) {
        socket = tls.connect(config.port, config.host, options, function() {
            socket.on('data', function(data) {
                // message format is assumed to be:
                // 1234["string", {...}]
                // where 1234 is message length
                recvBuffer += data.toString();

                // recv'd the msg length integer if we have a '[' char
                var msgLenEnd = recvBuffer.indexOf('[');
                if(msgLenEnd !== -1) {
                    var len = recvBuffer.substr(0, msgLenEnd);
                    var msg = recvBuffer.substr(msgLenEnd, len);

                    // got entire msg?
                    if(msg.length == len) {
                        // remove msg from buffer, then handle it
                        recvBuffer = recvBuffer.substr(msgLenEnd + len);

                        data = JSON.parse(msg);
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
