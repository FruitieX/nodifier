var config = require(process.env.HOME + '/.nodifier/config.js');
var inspect = require('util').inspect;
var ndutil = require('./ndutil.js');

var usageText = '';
usageText += 'This program manipulates and lists entries in nodifier.\n\n';
usageText += 'Usage:\n';
usageText += '  $0 [COMMAND] [OPTION]...\n\n';
usageText += 'Commands:\n';
usageText += '  ls            list entries (default)\n';
usageText += '  set [ENTRY]   edit entry where ENTRY is an id or category:id\n';
usageText += '  new [TEXT]    add new entry with text field set to TEXT';

var yargs = require('yargs')
    .usage(usageText)
    .describe('a', 'Show also entries without a due date set')
    .describe('c', 'Set category (default: ' + config.categories[0] + ')')
    .describe('d', 'Set due date (default: never)')
    .describe('h', 'Show this help and quit')
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

    if(argv._[0] === 'new') {
        /* add new entry */

        var entry = {};
        entry.category = argv.c || config.categories[0];
        argv._.shift();
        entry.text = argv._.join(' ');
        entry.app = 'task';
        if(argv.d) {
            entry.date = getDate(argv.d);
        }
        socket.send('set', entry);
        socket.on('updateResults', function(data) {
            if(data.err)
                console.log(data.err);
            else {
                console.log('Entry added.');
            }

            onexit(true);
        });
    } else if(argv._[0] === 'set') {
        /* edit entries */

        // first get the current entry list
        var query = { date: { "$exists": true }};
        if(argv.a) {
            query = null;
        }

        socket.send('search', {
            query: query,
            options: {
                sort: "category"
            }
        });

        // entry to modify may be referred to by just number (then category
        // todo is assumed), or by categoryName:number

        var fromCategory = config.categories[0];
        var index = argv.m;
        if(argv.m.toString().lastIndexOf(':') !== -1) {
            fromCategory = argv.m.toString().substr(0, argv.m.toString().lastIndexOf(':'));
            index = parseInt(argv.m.toString().substr(argv.m.toString().lastIndexOf(':') + 1));
        }

        socket.once('searchResults', function(data) {
            storeEntries(data);

            getEntry(entries, fromCategory, index, function(srcEntry) {
                if(!srcEntry) {
                    console.log("Error: entry not found!");
                    onexit(true);
                }
                srcEntry = _.clone(srcEntry);
                srcEntry.category = argv.c || config.categories[config.categories.length - 1];
                if(argv.d) {
                    srcEntry.date = getDate(argv.d);
                }
                socket.send('set', srcEntry);
                socket.on('updateResults', function(data) {
                    if(data.err)
                        console.log(data.err);
                    else {
                        printEntry(srcEntry, index);
                        process.stdout.write('\n');
                    }

                    onexit(true);
                });
            });
        });
    } else {
        /* show entries */

        // get all entries with a date (all entries if argv.a given)
        socket.send('search', {
            query: argv.a ? {} : { date: { "$exists": true }},
            options: {
                sort: "category"
            }
        });

        socket.on('searchResults', function(data) {
            storeEntries(data);
            printCategories(entries);
        });
        socket.on('update', function(data) {
            storeEntries(data);
            printCategories(entries);
        });

        process.stdin.setRawMode(true); // hide input
        process.stdout.write('\x1b[?25l'); // hide cursor
        process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal

        process.stdout.on('resize', function() {
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
});

console.log('connecting...');
