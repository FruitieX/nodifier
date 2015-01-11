#!/usr/bin/env node
var config = require(process.env.HOME + '/.nodifier/config.js');
var inspect = require('util').inspect;
var ndutil = require('./ndutil.js');

var usageText = '';
usageText += 'This program manipulates and lists entries in nodifier.\n\n';
usageText += 'Usage:\n';
usageText += '  $0 [COMMAND] [OPTION]...\n\n';
usageText += 'Commands:\n';
usageText += '  ls              list entries (default)\n';
usageText += '  add [TEXT]      add entry with text field set to TEXT';
usageText += '  ENTRY CATEGORY  move ENTRY to CATEGORY\n';
usageText += '  ENTRY TAG:VAL   set tag with value on ENTRY\n';
usageText += 'Legend:\n';
usageText += '  ENTRY:          category:id or id (uses default category)\n';

var yargs = require('yargs')
    .usage(usageText)
    .describe('a', 'Show also entries without a due date set')
    .describe('d', 'Set due date (default: never)')
    .describe('h', 'Show this help and quit')
    .string('d');

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

var newEntry = function() {
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
};

var showAllEntries = function() {
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
};

// "foo:42" -> {key:"foo", val:"42"}
// if only val is supplied, key will be set to defaultKey
var parseKeyValString = function(entry, defaultKey) {
    var key = defaultKey;
    var val = entry;
    if(entry.toString().lastIndexOf(':') !== -1) {
        key = entry.toString().substr(0, entry.toString().lastIndexOf(':'));
        val = entry.toString().substr(entry.toString().lastIndexOf(':') + 1);
    }

    return {
        key: key,
        val: val
    };
};

var setTag = function(entryString, tag) {
    var entry = parseKeyValString(entryString, config.categories[0]);
    entry.category = entry.key;
    entry.index = entry.val;

    var tag = parseKeyValString(tag);
    tag.tagName = tag.key;

    socket.once('searchResults', function(data) {
        storeEntries(data);

        getEntry(entries, entry.category, parseInt(entry.index), function(srcEntry) {
            if(!srcEntry) {
                console.log("Error: entry not found!");
                onexit(true);
            }
            srcEntry = _.clone(srcEntry);
            srcEntry[tag.tagName] = tag.val;

            socket.send('set', srcEntry);
            socket.on('updateResults', function(data) {
                if(data.err)
                    console.log(data.err);
                else {
                    printEntry(srcEntry, parseInt(entry.index));
                    process.stdout.write('\n');
                }

                onexit(true);
            });
        });
    });
};

var mvEntry = function(entryString, category) {
    var entry = parseKeyValString(entryString, config.categories[0]);
    entry.category = entry.key;
    entry.index = entry.val;

    socket.once('searchResults', function(data) {
        storeEntries(data);

        getEntry(entries, entry.category, parseInt(entry.index), function(srcEntry) {
            if(!srcEntry) {
                console.log("Error: entry not found!");
                onexit(true);
            }
            srcEntry = _.clone(srcEntry);
            if(category)
                srcEntry.category = category;
            else
                srcEntry.category = config.categories[config.categories.length - 1];

            if(argv.d) {
                srcEntry.date = getDate(argv.d, srcEntry.date);
            }

            socket.send('set', srcEntry);
            socket.on('updateResults', function(data) {
                if(data.err)
                    console.log(data.err);
                else {
                    printEntry(srcEntry, parseInt(entry.index));
                    process.stdout.write('\n');
                }

                onexit(true);
            });
        });
    });
};

var socket = new netEvent(options);

socket.on('open', function() {
    if(argv._[0] === 'add') {
        newEntry();
    } else {
        if(!_.isUndefined(argv._[0])) { // 2nd arg seen: is either move or tag cmd
            if(argv._[1] && argv._[1].match(/.+:.+/)) { // match tag:value
                setTag.apply(this, argv._);
            } else {
                mvEntry.apply(this, argv._);
            }
        } else { // else ls cmd
            showAllEntries();
        }

        // above cmds all need to fetch entire entry list
        socket.send('search', {
            query: {}
        });
    }
});

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

console.log('connecting...');
