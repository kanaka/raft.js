#!/usr/bin/env node

local = require('./local');

function startTest (opts) {
    for (var i=0; i < 3; i++) {
        new local.RaftServerLocal(i, [0,1,2], opts);
    }
}

function getAll(attr) {
    var results = {};
    for (var i in local._serverPool) {
        if (!local._serverPool.hasOwnProperty(i)) { continue; }
        results[i] = local._serverPool[i]._self[attr];
    }
    return results;
}
 
function getLeaderId() {
    for (var i in local._serverPool) {
        if (!local._serverPool.hasOwnProperty(i)) { continue; }
        if (local._serverPool[i]._self.state === 'leader') {
            return i;
        }
    }
    return null;
}


if (require.main === module) {
    startTest();
} else {
    exports.startTest = startTest;
    exports.local = local;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
