// Usage:
// - Start rtc_server.js first:
//   ./rtc_server --port 8000
//
// - Then use a docker build of slimerjs to run the test:
//   IP_ADDR=$(hostname -I | awk '{print $1}')
//   docker run -it -v `pwd`/test/rtc.js:/rtc.js fentas/slimerjs slimerjs /rtc.js http://${IP_ADDR}:8000/

var system = require('system'),
    webpage = require('webpage'),
    channel = Math.round(Math.random()*1000000),
    base_address = system.args[1],
    server_count = (system.args.length >= 3) ? parseInt(system.args[2]) : 3;

var query = '?channel='+ channel + '&console_logging=true';

function new_instance(page_id, firstServer) {
    var page = webpage.create();

    // Register external handlers
    page.onConsoleMessage = function (msg, line, origin) {
        console.log("CONSOLE " + page_id + ": " + msg);
    };
    page.onCallback = function(msg) {
        console.log("CALLBACK " + page_id + ": " + msg);
        if (msg === 'QUIT') {
            console.log("Normal exit");
            slimer.exit(0);
        }
    };

    var full_address = base_address;

    if (!firstServer) {
        full_address += "/chat.html";
    }
    full_address += query + (firstServer ? "#firstServer" : "");

    console.log("Opening " + full_address);

    page.open(full_address, function(status) {
        if (status !== 'success') {
            console.log('Unable to load the address!');
            phantom.exit(1);
        }
        var mainTitle = page.evaluate(function () {
            return document.title;
        });
        setTimeout(function() {
            console.log('Saving image /tmp/chat' + page_id + '.png');
            page.render('/tmp/chat' + page_id + '.png');
        }, 10000);
    });

    return page;
}

new_instance(0, true);
for (var i=1; i < server_count; i++) {
    new_instance(i, false);
}
