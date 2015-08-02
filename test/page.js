var system = require('system'),
    page = require('webpage').create(),
    address = system.args[1],
    timeout = (system.args.length >= 3) ? parseInt(system.args[2]) : 20;

// Register external handlers
page.onConsoleMessage = function (msg, line, origin) {
    console.log("CONSOLE: " + origin + ":" + line + ", " + msg);
};
page.onCallback = function(msg) {
    console.log("CALLBACK: " + msg);
    if (msg === 'QUIT') {
        console.log("Normal exit");
        slimer.exit(0);
    }
};

page.open(address, function(status) {
    if (status !== 'success') {
        console.log('Unable to load the address!');
        phantom.exit(1);
    } else {
        window.setTimeout(function () {
            console.log("Timeout after " + timeout + " seconds");
            slimer.exit(1);
        }, timeout * 1000);
    }
    var mainTitle = page.evaluate(function () {
        console.log('RTCPeerConnection:', window.RTCPeerConnection);
        console.log('mozRTCPeerConnection:', window.mozRTCPeerConnection);
        window.callPhantom("test of callPhantom");
        //window.callPhantom("QUIT");
        return document.title;
    });
    console.log('Returned from page: ' + mainTitle);
    //slimer.exit()
});
