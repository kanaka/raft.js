if (typeof module === 'undefined') {
    var test_common = {},
        exports = test_common;
}

serverData = {};

pendingServerMap = {};

function startServers (spool, serverOpts, klass) {
    for (var sid in serverOpts) {
        var addr = serverOpts[sid].listenAddress;
        serverData[sid] = addr;
    }
    var sids = Object.keys(serverOpts);
    for (var idx = 0; idx < sids.length; idx++) {
        sid = sids[idx];
        // force debug so _self is exposed for get* functions
        serverOpts[sid].debug = true;
        serverOpts[sid].serverData = serverData;
        if (idx === 0) {
            // Tell the first server to initialize
            serverOpts[sid].firstServer = true;
        } else {
            // Add the other servers to the add list
            pendingServerMap[sid] = serverOpts[sid].listenAddress;
        }
        spool[sid] = new klass(sid.toString(), serverOpts[sid]);
    }
}

// Call leader addServer RPC to add list of new servers.
function addServersAsync(spool) {
    var sids = Object.keys(pendingServerMap);
    console.log("addServersAsync (remaining: " + sids.length + ")");

    if (sids.length > 0) {
        // Determine the leader
        var lid = getLeaderId(spool);
        if (lid) {
            var sid = sids[0];
            console.log("addServersAsync attempting addServer: " + sid);
            spool[lid].addServer({newServer: sid},
                    function (result) {
                        //console.log("result:", result);
                        if (result.status === 'OK') {
                            delete pendingServerMap[sid];
                        } else if (result.status === 'ALREADY_A_MEMBER') {
                            console.log("addServersAsync: " + result.status);
                            delete pendingServerMap[sid];
                        } else {
                            console.log("addServersAsync: coud not add server: " + result.status);
                        }
                    });
        } else {
            console.log("addServersAsync: no leader yet, delaying");
        }
        setTimeout(function() { addServersAsync(spool); }, 250);
    }
}

/*
function addServer (spool, sid, opts, klass) {
    if (sid in serverData) {
        throw new Error("Server " + sid + " already exists");
    }
    var lid = getLeaderId(spool);
    if (!lid) {
        throw new Error("Could not determine current leader");
    }
    var addr = opts.listenAddress;
    serverData[sid] = addr;
    opts.serverData = serverData;
    spool[sid] = new klass(sid.toString(), opts);
    spool[lid].addServer({newServer: [sid, addr]},
            function(res) {
                console.log("addServer result:", res);
            });
}

function removeServer(spool, sid) {
    if (!sid in serverData) {
        throw new Error("Server " + sid + " does not exists");
    }
    var lid = getLeaderId(spool);
    if (!lid) {
        throw new Error("Could not determine current leader");
    }
    delete serverData[sid];
    spool[lid].removeServer(serverData,
            function(res) {
                console.log("removeServer result:", res);
            });

}
*/

function getAll(spool, attr) {
    var results = {};
    for (var i in spool) {
        if (!spool.hasOwnProperty(i)) { continue; }
        results[i] = spool[i]._self[attr];
    }
    return results;
}

function getLeaderId(spool) {
    for (var i in spool) {
        if (!spool.hasOwnProperty(i)) { continue; }
        if (spool[i]._self.state === 'leader') {
            return i;
        }
    }
    return null;
}

///////////////////////////////////////////////////////////////////////////

// From: http://stackoverflow.com/questions/1068834/object-comparison-in-javascript
function deepCompare () {
  var i, l, leftChain, rightChain;

  function compare2Objects (x, y) {
    var p;

    // remember that NaN === NaN returns false
    // and isNaN(undefined) returns true
    if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
         return true;
    }

    // Compare primitives and functions.     
    // Check if both arguments link to the same object.
    // Especially useful on step when comparing prototypes
    if (x === y) {
        return true;
    }

    // Works in case when functions are created in constructor.
    // Comparing dates is a common scenario. Another built-ins?
    // We can even handle functions passed across iframes
    if ((typeof x === 'function' && typeof y === 'function') ||
       (x instanceof Date && y instanceof Date) ||
       (x instanceof RegExp && y instanceof RegExp) ||
       (x instanceof String && y instanceof String) ||
       (x instanceof Number && y instanceof Number)) {
        return x.toString() === y.toString();
    }

    // At last checking prototypes as good a we can
    if (!(x instanceof Object && y instanceof Object)) {
        return false;
    }

    if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
        return false;
    }

    if (x.constructor !== y.constructor) {
        return false;
    }

    if (x.prototype !== y.prototype) {
        return false;
    }

    // Check for infinitive linking loops
    if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
         return false;
    }

    // Quick checking of one object beeing a subset of another.
    // todo: cache the structure of arguments[0] for performance
    for (p in y) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
            return false;
        }
        else if (typeof y[p] !== typeof x[p]) {
            return false;
        }
    }

    for (p in x) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
            return false;
        }
        else if (typeof y[p] !== typeof x[p]) {
            return false;
        }

        switch (typeof (x[p])) {
            case 'object':
            case 'function':

                leftChain.push(x);
                rightChain.push(y);

                if (!compare2Objects (x[p], y[p])) {
                    return false;
                }

                leftChain.pop();
                rightChain.pop();
                break;

            default:
                if (x[p] !== y[p]) {
                    return false;
                }
                break;
        }
    }

    return true;
  }

  if (arguments.length < 1) {
    return true; //Die silently? Don't know how to handle such case, please help...
    // throw "Need two or more arguments to compare";
  }

  for (i = 1, l = arguments.length; i < l; i++) {

      leftChain = []; //Todo: this can be cached
      rightChain = [];

      if (!compare2Objects(arguments[0], arguments[i])) {
          return false;
      }
  }

  return true;
}


function showState(spool) {
    var logs = [], sms = [];
    console.log("Logs:");
    for (var sid in spool) {
        console.log(sid + ": " + JSON.stringify(spool[sid]._self.log));
    }
    console.log("State Machines:");
    for (var sid in spool) {
        console.log(sid + ": " + JSON.stringify(spool[sid]._self.stateMachine));
    }
}

function validateState(spool) {
    // Validate that there is one and only one leader
    var leaderIds = Object.keys(spool);
    var leaderCnt = 0;
    for (var i in spool) {
        if (!spool.hasOwnProperty(i)) { continue; }
        if (spool[i]._self.state === 'leader') {
            leaderCnt += 1;
        }
    }
    if (leaderCnt !== 1) {
        throw new Error("FAIL: Found " + leaderCnt +
                        " leaders, expected 1");
    }

    // Validate that the logs and stateMachines are the same on every
    // server
    var logs = [], sms = [];
    for (var sid in spool) {
        logs.push(spool[sid]._self.log);
        sms.push(spool[sid]._self.stateMachine);
    }

    if (!deepCompare.apply(null, logs)) {
        showState(spool);
        throw new Error("Logs do not all match");
    }
    if (!deepCompare.apply(null, sms)) {
        showState(spool);
        throw new Error("stateMachines do not all match");
    }

    return true;
}

exports.startServers = startServers;
exports.addServersAsync = addServersAsync;
//exports.addServer = addServer;
exports.getAll = getAll;
exports.getLeaderId = getLeaderId;
exports.showState = showState;
exports.validateState = validateState;
