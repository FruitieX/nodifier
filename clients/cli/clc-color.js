var clc = require('cli-color');

exports.id_color = clc.xterm(232).bgWhiteBright;
exports.date_color = clc.xterm(242);
exports.no_unread_color = clc.xterm(242);
exports.def_app_color = clc.white.bgXterm(242);
exports.def_context_color = clc.whiteBright.bgXterm(232);

exports.color_from_text = function(fg, bg) {
    var color = clc;

    switch(fg) {
        case 'black':            color = color.black; break;
        case 'red':                color = color.red; break;
        case 'green':            color = color.green; break;
        case 'yellow':            color = color.yellow; break;
        case 'blue':            color = color.blue; break;
        case 'magenta':            color = color.magenta; break;
        case 'cyan':            color = color.cyan; break;
        case 'white':            color = color.white; break;

        case 'blackBright':        color = color.blackBright; break;
        case 'redBright':        color = color.redBright; break;
        case 'greenBright':        color = color.greenBright; break;
        case 'yellowBright':    color = color.yellowBright; break;
        case 'blueBright':        color = color.blueBright; break;
        case 'magentaBright':    color = color.magentaBright; break;
        case 'cyanBright':        color = color.cyanBright; break;
        case 'whiteBright':        color = color.whiteBright; break;
        default:                color = color.whiteBright;
    }
    switch(bg) {
        case 'black':            color = color.bgBlack; break;
        case 'red':                color = color.bgRed; break;
        case 'green':            color = color.bgGreen; break;
        case 'yellow':            color = color.bgYellow; break;
        case 'blue':            color = color.bgBlue; break;
        case 'magenta':            color = color.bgMagenta; break;
        case 'cyan':            color = color.bgCyan; break;
        case 'white':            color = color.bgWhite; break;

        case 'blackBright':        color = color.bgBlackBright; break;
        case 'redBright':        color = color.bgRedBright; break;
        case 'greenBright':        color = color.bgGreenBright; break;
        case 'yellowBright':    color = color.bgYellowBright; break;
        case 'blueBright':        color = color.bgBlueBright; break;
        case 'magentaBright':    color = color.bgMagentaBright; break;
        case 'cyanBright':        color = color.bgCyanBright; break;
        case 'whiteBright':        color = color.bgWhiteBright; break;
    }

    return color;
};

