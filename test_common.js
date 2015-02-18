if (typeof module === 'undefined') {
    var test_common = {},
        exports = test_common;
}

serverMap = {};

function startServers (spool, serverOpts, klass) {
    for (var sid in serverOpts) {
        var addr = serverOpts[sid].listenAddress;
        serverMap[sid] = addr;
    }
    for (var sid in serverOpts) {
        // force debug so _self is exposed for get* functions
        serverOpts[sid].debug = true;
        serverOpts[sid].serverMap = serverMap;
        spool[sid] = new klass(sid.toString(), serverOpts[sid]);
    }
}

function addServer (spool, sid, opts, klass) {
    if (sid in serverMap) {
        throw new Error("Server " + sid + " already exists");
    }
    var lid = getLeaderId(spool);
    if (!lid) {
        throw new Error("Could not determine current leader");
    }
    var addr = opts.listenAddress;
    serverMap[sid] = addr;
    opts.serverMap = serverMap;
    spool[sid] = new klass(sid.toString(), opts);
    spool[lid].changeMembership(serverMap,
            function(res) {
                console.log("addServer result:", res);
            });
}

function removeServer(spool, sid) {
    if (!sid in serverMap) {
        throw new Error("Server " + sid + " does not exists");
    }
    var lid = getLeaderId(spool);
    if (!lid) {
        throw new Error("Could not determine current leader");
    }
    delete serverMap[sid];
    spool[lid].changeMembership(serverMap,
            function(res) {
                console.log("removeServer result:", res);
            });

}

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
        throw new Error("Logs do not all match");
    }
    if (!deepCompare.apply(null, sms)) {
        throw new Error("stateMachines do not all match");
    }

    return true;
}

exports.startServers = startServers;
exports.addServer = addServer;
exports.getAll = getAll;
exports.getLeaderId = getLeaderId;
exports.validateState = validateState;
