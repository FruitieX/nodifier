var gcm = require('node-gcm');

// HTTP - socket.io bridge to enable applications supporting HTTP to interact with nodifier
var fs = require('fs');
var _ = require('underscore');

var config = require(process.env.HOME + '/.nodifier/config.js');
var options = {
    tls: config.tls,
    key: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-key.pem'),
    cert: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    ca: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    rejectUnauthorized: config.rejectUnauthorized
};

var socket = require('socket.io-client')((config.tls ? 'https://' : 'http://') + config.host + ':' + config.port, options);

socket.on('newNotification', function(notification) {
    console.log('got notification:\n' + JSON.stringify(notification, undefined, 4));
    sendNotification(notification, 'newNotification');
});
socket.on('markAs', function(notifications) {
    console.log('marking notifications as (un)read:\n' + JSON.stringify(notifications, undefined, 4));
    _.each(notifications, function(notification) {
        sendNotification(notification, 'markAs');
    });
});

socket.on('broadcast', function(data) {
    if(data.gcmRegistrationId) {
        console.log('received new gcm registration id: ' + data.gcmRegistrationId);
        fs.writeFileSync('./registration-id.js', data.gcmRegistrationId);
    }
});

socket.on('connect', function() {
    console.log('connected to nodifier server');
});

var skipSources = ['mail'];

var sendNotification = function(notification, method) {
    if(skipSources.indexOf(notification.source) !== -1) {
        console.log('skipping notification from source ' + notification.source);
        return;
    }

    var data = {
        method: method,
        read: notification.read,
        uid: notification.uid,
        source: notification.source,
        context: notification.context,
        text: notification.text
    };
    console.log('sending data:\n' + JSON.stringify(data, undefined, 4));

    var message = new gcm.Message({
        collapseKey: notification.source,
        data: data
    });

    // Set up the sender with you API key
    var sender = new gcm.Sender('AIzaSyALor_3AjiuMY80cLR-M-aZ_mo88Dxqqz0');

    // Add the registration IDs of the devices you want to send to
    var registrationIds = [];
    registrationIds.push(fs.readFileSync('./registration-id.js').toString('utf-8'));
    console.log('using registration ids: ' + JSON.stringify(registrationIds));
    sender.send(message, registrationIds, function (err, result) {
      if(err) console.error(err);
      else    console.log(result);
    });
};
