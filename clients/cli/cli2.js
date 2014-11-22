var clc = require('cli-color');
var clc_color = require(__dirname + '/clc-color.js');

var config = require(process.env.HOME + '/.nodifier/config.js');
var inspect = require('util').inspect;

// networking
var netEvent = require('net-event');
var fs = require('fs');
var _ = require("underscore");

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
var categories = [];

socket.on('set', function(data) {
    if(data.err) {
        console.log(inspect(data.err));
        return;
    }

    categories = _.groupBy(data.entries, 'category');
    _.each(_.sortBy(_.keys(categories), function(category) {
        return config.categories.indexOf(category) * -1;
    }), printCategory);
});

var printCategory = function(category) {
    // descending sort by date
    var sorted = _.sortBy(categories[category], 'date');

    _.each(sorted, printEntry);
};

var printEntry = function(entry) {
    console.log(entry);
};

/*
socket.send('set', {
    category: "todo",
    text: "hello world 39",
    app: "mail",
    context: "gmail"
});
socket.send('set', {
    category: "done",
    text: "hello done 2",
    app: "mail",
    context: "gmail"
});
socket.send('set', {
    category: "done",
    text: "hello done",
    app: "mail",
    context: "gmail"
});
socket.send('set', {
    category: "wip",
    text: "foo bar",
    app: "mail",
    context: "gmail"
});
*/

socket.send('get', {
    query: {},
    options: {
        sort: "category"
    }
});
