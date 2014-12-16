var config = require(process.env.HOME + '/.nodifier/config.js');
var inspect = require('util').inspect;
var ndutil = require('./ndutil.js');

var yargs = require('yargs')
    .usage('Get/manipulate entries in nodifier.\nUsage: $0')
    .example('$0 -a -m 2', 'mark entry 2 as done')
    .describe('a', 'Show all entries')
    .describe('c', 'Category')
    .describe('m', 'Move/mark entry')
    .describe('n', 'New entry')
    .describe('h', 'Show this help')
    .boolean('n');

var argv = yargs.argv;
if(argv.h) {
    console.log(yargs.help());
    process.exit(0);
}

var entries = {};

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

socket.on('open', function() {
    /* TODO: race condition, this function is no good :( */
    var getAll = function(query, callback) {
        socket.send('get', {
            query: query || {},
            options: {
                sort: "category"
            }
        });
        socket.on('get', function(data) {
            if(callback)
                callback(data);
        });
    }

    var storeEntries = function(data) {
        if(data.err) {
            console.log(inspect(data.err));
            return;
        }

        _.each(data.entries, function(entry) {
            entries[entry._id] = entry;
        });

        return entries;
    };


    /*
    if(quitQuery && JSON.stringify(data.query) === quitQuery)
        onexit(true);
    */

    var recvQuitId;
    if(argv.n) {
        var entry = {};
        entry.category = argv.c || config.categories[0];
        entry.text = argv._.join(' ');
        entry.app = 'task';
        if(argv.d) {
            entry.date = getDate(argv.d);
        }
        socket.send('set', entry);
    } else if(argv.m || argv.m === 0) {
        var query = { date: { "$exists": true }};
        if(argv.a) {
            query = null;
        }

        getAll(query, function(data) {
            storeEntries(data);

            console.log(entries);

            // TODO: can't use argv.c both here and below
            getEntry(entries, (argv.c || config.categories[0]), parseInt(argv.m), function(srcEntry) {
                if(!srcEntry) {
                    console.log("Error: entry not found!");
                    onexit(true);
                }
                srcEntry = _.clone(srcEntry);
                srcEntry.category = argv.c || config.categories[config.categories.length - 1];
                recvQuitId = srcEntry._id;
                socket.send('set', srcEntry);
                socket.on('set', function(data) {
                    if(data._id == recvQuitId)
                        onexit(true);
                });
            });
        });
    } else if(argv.a) {
        getAll(null, function(data) {
            storeEntries(data);
            printCategories(entries);
        });

        socket.on('set', function(data) {
            storeEntries(data);
            printCategories(entries);
        });
    } else {
        getAll({ date: { "$exists": true }}, function(data) {
            storeEntries(data);
            printCategories(entries);
        });
    }

    var onexit = function(noClear) {
        socket.close();
        process.stdout.write('\x1b[?25h'); // enable cursor
        if(!noClear)
            process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
        process.exit();
    };
    process.on('SIGINT', onexit);

    // q or ctrl-c pressed: run onexit
    process.stdin.on('data', function(key) {
        if(key == 'q' || key == '\u0003') onexit();
    });

    process.stdin.setRawMode(true); // hide input
    process.stdout.write('\x1b[?25l'); // hide cursor
    process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal

    process.stdout.on('resize', function() {
        process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal
        printCategories(entries);
    });
});

console.log('connecting...');
