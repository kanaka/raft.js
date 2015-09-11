#!/usr/bin/env node

var spawn = require('child_process').spawn,
    Twst = require('twst').Twst,
    twst = new Twst(),
    clientCount = process.argv.length >= 3 ? parseInt(process.argv[2]) : 1,
    timeout = (clientCount*10)*1000;

var url = 'http://192.168.2.3:9000/test/index.html';

function loadPage(url, opts) {
    opts = opts || {};
    var prefix = opts.prefix || "";
    var docker_args = ['run', '-it', '--rm',
        '-v', process.cwd() + '/test:/test',
        'slimerjs-wily',
        'slimerjs', '/test/launch.js',
        url,
        timeout];

    console.log(prefix + 'launching ' + url);
    //console.log('docker', docker_args.join(" "));
    var page = spawn('docker', docker_args);

    page.stdout.on('data', function(chunk) {
        console.log(prefix + chunk.toString().replace(/\n$/,''));
    });

    page.on('close', function (code) {
        console.log(prefix + 'docker container exited with code ' + code);
        process.exit(code);
    });
    return page;
}

var pages = [];
for (var i=0; i<clientCount; i++) {
    pages.push(loadPage(url, {prefix: 'p' + i + ': '}));
}

setInterval(function() {
    if (Object.keys(twst.clients).length >= clientCount) {
        process.exit(0);
    }
}, 100);

setTimeout(function() {
    console.log("timeout waiting for clients");
    process.exit(1);
}, timeout);

/*
function test_func() {
    return location.search + Math.random();
}

setInterval(function() {
    var opts = {timeout: 10000,
                restype: 'return'};
    twst.collect(test_func, opts, function(result, data) {
        console.log('collect result:', result, data);
    });
}, 6000);
*/
