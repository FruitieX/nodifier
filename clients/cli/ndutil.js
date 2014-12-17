var config = require(process.env.HOME + '/.nodifier/config.js');
var clc_color = require(__dirname + '/clc-color.js');
var _ = require('underscore');
var crypto = require('crypto');

module.exports = function() {
    this.hashObjID = function(s) {
        return crypto.createHash('sha1').update(s).digest('hex').substr(0, 24);
    }

    this.printEntry = function(entry, index) {
        var app_color = clc_color.def_app_color;
        if(entry.appfg || entry.appbg)
            app_color = clc_color.color_from_text(entry.appfg, entry.appbg);
        var context_color = clc_color.def_context_color;
        if(entry.contextfg || entry.contextbg)
            context_color = clc_color.color_from_text(entry.contextfg, entry.contextbg);

        var date_string;
        if(entry.date) {
            var date_arr = new Date(entry.date).toString().split(' ');
            date_string = date_arr[1] + ' ' + date_arr[2] + ' ';
        } else {
            date_string = Array(8).join(' ');
        }

        var pos_string = index.toString();

        // find length of string before entry.text, shorten entry.text if
        // wider than our terminal
        var app_string = ''; context_string = '';
        if(entry.app)
            app_string = ' ' + entry.app + ' ';
        if(entry.context)
            context_string = ' ' + entry.context + ' ';

        var pre_text = date_string + ' ' + pos_string + ' ' + app_string + context_string + ' ';
        var text_length = entry.text.length;
        var text = entry.text
        if(pre_text.length + text_length > process.stdout.columns)
            text = text.substr(0, process.stdout.columns - pre_text.length - 3) + '...';

        process.stdout.write('\n');
        process.stdout.write(clc_color.date_color(date_string) + clc_color.id_color(' ' + pos_string + ' ') + app_color(app_string) + context_color(context_string) + ' ' + text);
    };

    this.foreachCategory = function(entries, callback) {
        var categories = _.groupBy(entries, 'category');

        // sort entries within each category first by lastModified, then by date
        _.each(categories, function(category, key) {
            categories[key] = _.sortBy(_.sortBy(category, 'lastModified').reverse(), 'date').reverse();
        });

        // loop over categories in order set by config and callback
        _.each(_.sortBy(_.keys(categories), function(categoryName) {
            return config.categories.indexOf(categoryName) * -1;
        }), function(categoryName) {
            callback(categoryName, categories);
        });
    };

    this.getEntry = function(entries, categoryName, index, callback) {
        var found = false;

        foreachCategory(entries, function(_categoryName, categories) {
            // found correct category
            if(!found && _categoryName === categoryName) {
                var categoryEntries = categories[categoryName];
                callback(categoryEntries[index]);

                found = true;
            }
        });

        if(!found)
            callback(null);
    };

    this.printCategories = function(entries) {
        process.stdout.write('\u001B[2J\u001B[0;0f'); // clear terminal

        foreachCategory(entries, function(categoryName, categories) {
            printCategory(categoryName, categories[categoryName]);
        });
    };

    this.printCategory = function(categoryName, categoryEntries) {
        process.stdout.write('\n\n' + categoryName + ':');

        _.each(categoryEntries, function(entry, index) {
            printEntry(entry, index);
        });
    };

    this.getDate = function(s, oldDate) {
        if(s === 'never') {
            return undefined;
        }

        var d = new Date();

        if(s[0] === '+') {
            d.setTime(oldDate);
        } else if (s[0] === '-') {
            d.setTime(oldDate);
        }

        var startDate = d.getDate();
        console.log(s);

        if(s[s.length - 1] === 'd') {
            d.setDate(startDate + parseInt(s.substr(0, s.length - 1)));
        } else if(s[s.length - 1] === 'w') {
            d.setDate(startDate + parseInt(s.substr(0, s.length - 1)) * 7);
        } else if(s[s.length - 1] === 'm') {
            d.setDate(startDate + parseInt(s.substr(0, s.length - 1)) * 30); // approx 30 days
        }
        return d.getTime();
    };
}();
