var webpage = require('webpage'),
    system = require('system'),
    url = system.args[1],
    timeout = (system.args.length >= 3) ? parseInt(system.args[2]) : 120;

var page = webpage.create();

page.onConsoleMessage = function (msg, line, origin) {
    console.log('CONSOLE: ' + msg);
};

page.onCallback = function(msg) {
    console.log('CALLBACK: ' + msg);
    if (msg === 'QUIT') {
        //console.log('Normal exit');
        slimer.exit(0);
    }
};

console.log('Loading ' + url);
page.open(url, function(status) {
    if (status !== 'success') {
        console.log('Unable to load the address!');
        phantom.exit(1);
    }
});

setTimeout(function() {
    console.log('Timeout');
    phantom.exit(1);
}, timeout*1000);
