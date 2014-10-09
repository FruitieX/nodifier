#!/usr/bin/env node

var config = require(process.env.HOME + '/.nodifier/config.js');
var crypto = require('crypto');
var fs = require('fs');
var unreadNotifications = [];
var readNotifications = [];
if(fs.existsSync(process.env.HOME + '/.nodifier/unreadNotifications.json')) {
    unreadNotifications = JSON.parse(fs.readFileSync(
                          process.env.HOME + '/.nodifier/unreadNotifications.json'));
}
if(fs.existsSync(process.env.HOME + '/.nodifier/readNotifications.json')) {
    readNotifications = JSON.parse(fs.readFileSync(
                          process.env.HOME + '/.nodifier/readNotifications.json'));
}

var writeToFile = function() {
    fs.writeFileSync(process.env.HOME + '/.nodifier/unreadNotifications.json',
                     JSON.stringify(unreadNotifications));
    fs.writeFileSync(process.env.HOME + '/.nodifier/readNotifications.json',
                     JSON.stringify(readNotifications));
};

// find index for new notification based on its timestamp
// assumes 'array' is sorted in ascending order according to .date fields
var findId = function(date, array) {
    for (var i = 0; i < array.length; i++) {
        if(array[i].date >= date)
            return i;
    }

    return array.length;
};

// store notification in (un)readNotifications array at a date sorted index
var storeNotification = function(data_json, read) {
    if(data_json.text) {
        data_json.text = data_json.text.toString();
        data_json.text = data_json.text.replace('\t',' '); // tabs to single spaces
        data_json.text = data_json.text.replace(/^\s*/, ""); // get rid of leading ws
        data_json.text = data_json.text.replace(/\s*$/, ""); // get rid of trailing ws
    }

    // plugin did not provide timestamp, create one from current time
    if(!data_json.date)
        data_json.date = new Date().valueOf();

    var primaryArray = unreadNotifications; var secondaryArray = readNotifications;
    if(read) {
        primaryArray = readNotifications; secondaryArray = unreadNotifications;
    }

    if(data_json.uid) {
        // notification has a set UID:
        // look for notification with duplicate UID in both arrays. if found, remove
        var i;
        for(i = primaryArray.length - 1; i >= 0; i--) {
            if(primaryArray[i].uid === data_json.uid) {
                primaryArray.splice(i, 1);
            }
        }
        // look in unread array too, if duplicate UID found there, remove it
        for(i = secondaryArray.length - 1; i >= 0; i--) {
            if(secondaryArray[i].uid === data_json.uid) {
                secondaryArray.splice(i, 1);
            }
        }
    } else {
        // notification lacks UID: generate a pseudo random hash and set it as the UID
        var shasum = crypto.createHash('md5');
        shasum.update(String(Math.random()));
        data_json.uid = shasum.digest('base64');
    }

    if (read) {
        // insert notification at end of readNotifications array
        readNotifications.push(data_json);

        // if readNotifications is full, pop from beginning
        if(readNotifications.length >= config.numReadToKeep) {
            readNotifications.splice(0, 1);
        }

        return readNotifications.length - 1;
    } else {
        // insert notification to unreadNotifications array
        var id = findId(data_json.date, unreadNotifications);
        unreadNotifications.splice(id, 0, data_json);

        return id;
    }
};

// return notifications with matching id, uid, source, context
// if id is given only it will be used. if id is undefined search using other
// fields. undefined fields not included in search.
var range_re = /(\d*)\.\.(\d*)/;
var searchNotifications = function(id, uid, source, context, read) {
    var array = read ? readNotifications : unreadNotifications;

    if(id) {
        var range = id.match(range_re);
        if(range) {
            var min = range[1] || 0;
            var max = range[2] || 9999999999999;
            min = parseInt(min);
            max = parseInt(max);

            if (min > max) {
                var temp = min;
                min = max;
                max = temp;
            }
            return array.filter(function (notification, i) {
                return (i >= min && i <= max);
            });
        } else {
            return array.filter(function (notification, i) {
                return i == id;
            });
        }
    } else {
        return array.filter(function (notification) {
            return (!uid || (notification.uid == uid)) && (!source || (notification.source.toUpperCase() == source.toUpperCase())) && (!context || (notification.context.toUpperCase() == context.toUpperCase()));
        });
    }
};

// update .(un)readID and .read properties of all notifications
var updateIDRead = function() {
    var i;
    for (i = 0; i < unreadNotifications.length; i++) {
        unreadNotifications[i].unreadID = i;
        unreadNotifications[i].read = false;
    }
    for (i = 0; i < readNotifications.length; i++) {
        readNotifications[i].readID = i;
        readNotifications[i].read = true;
    }
};

// mark notifications as (un)read
// move notifications between (un)readNotifications arrays accordingly
// NOTE: all given notifications must already be in (un)readNotifications
var markAs = function(notifications, read) {
    var msg = "";

    // check if arg is object, then make it into an array
    if(Object.prototype.toString.call(notifications) === '[object Object]') {
        notifications = [notifications];
    }

    var i;
    var notification;

    // update read boolean field of every given notification
    for (i = 0; i < notifications.length; i++) {
        notifications[i].read = read;
    }

    // loop through (un)readNotifications. see if we can find any that were
    // marked as (un)read and thus belong to the other array, move these
    if(read) {
        for(i = unreadNotifications.length - 1; i >= 0; i--) {
            if(unreadNotifications[i].read) {
                notification = unreadNotifications[i];
                unreadNotifications.splice(i, 1);
                storeNotification(notification, true);
            }
        }
    } else {
        for(i = readNotifications.length - 1; i >= 0; i--) {
            if(!readNotifications[i].read) {
                notification = readNotifications[i];
                readNotifications.splice(i, 1);
                storeNotification(notification, false);
            }
        }
    }
};

// networking
var netEvent = require('net-event');
var options = {
    server: true,
    port: config.port,
    tls: true,
    key: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-key.pem'),
    cert: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    ca: fs.readFileSync(process.env.HOME + '/.nodifier/nodifier-cert.pem'),
    requestCert: true,
    rejectUnauthorized: true
};
var server = new netEvent(options);

server.on('open', function(socket) {
    socket.on('newNotification', function(notification) {
        // add new notification
        var id = storeNotification(notification, false);
        updateIDRead(); // indices may have changed, fix them
        writeToFile();

        // broadcast new notification to all connected clients
        socket.broadcast('newNotification', unreadNotifications[id]);
    });
    socket.on('markAs', function(search) {
        // search for notifications and mark results as (un)read according to s.read
        notifications = searchNotifications(search.id, search.uid, search.source, search.context, !search.read);
        if(notifications.length) {
            markAs(notifications, search.read);
            updateIDRead(); // indices/read states may have changed, fix them
            writeToFile();

            // broadcast updated notifications to all other connected clients
            socket.broadcast('markAs', notifications, true);
        }

        // send matching notifications (or empty array) to requesting client
        socket.send('notifications', notifications);
    });
    socket.on('getRead', function() {
        socket.send('notifications', readNotifications);
    });
    socket.on('getUnread', function(search) {
        // get unread notifications by id, or all notifications if no search terms
        if(!search) {
            notifications = unreadNotifications;
        } else {
            notifications = searchNotifications(search.id, search.uid, search.source, search.context, false);
        }

        socket.send('notifications', notifications);
    });

    socket.setKeepAlive(true);
    socket.setNoDelay(true);
});

console.log('nodifier tls server listening on port ' + config.port);

process.on('uncaughtException', function (err) {
    console.error(err.stack);
    console.log("ERROR! Node not exiting.");
});
