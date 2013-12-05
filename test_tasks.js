var serverPool = local._serverPool;
var serverIdx = 0;
var tqueueOpts = {};
var tqueue = tasks.Tasks(tqueueOpts);


function startServers(opts, n, msgCallback) {
    n = n || 5;
    msgCallback = msgCallback ||
                  function(msg) { console.log.call(console, msg); };
    var serverOpts = {};
    for (var i=0; i < n; i++) {
        serverOpts[i] = local.copyMap(opts);
        (function () {
            var sidx = i,
                sopts = serverOpts[i];
            sopts.verbose = true;
            sopts.listenAddress = "Node " + (serverIdx++);
            sopts.schedule = function (action, time, data) {
                data = data || {};
                data.type = data.type || action.name;
                data.id = sopts.listenAddress;
                data.idx = sidx;
                return tqueue.schedule(action, time, data);
            };
            sopts.unschedule = function (id) {
                tqueue.cancel(id);
            };
            sopts.log = function() {
                var msg = Array.prototype.join.call(arguments, " ");
                msg = msg.replace(/^[0-9]*:/, tqueue.currentTime() + ":");
                msgCallback(msg);
            };
        })();
    }
    // Create the servers
    var ret = test_common.startServers(serverPool, serverOpts,
                                       local.RaftServerLocal);
    // Wrap the sendRPC and applyCmd with a scheduled version
    // Note the double closures: one for the sendRPC and one inside
    // that for the wrapped callback response
    for (var i=0; i < n; i++) {
        (function () {
            var sidx = i,
                sopts = serverOpts[i],
                origSendRPC = serverOpts[i].sendRPC,
                origSaveFn = serverOpts[i].saveFn;
            sopts.sendRPC = function (sid, rpc, args, callback) {
                var nsid = sid,
                    nrpc = rpc,
                    nargs = args,
                    ncallback;
                ncallback = function (tid, cargs) {
                    var data = {type: "RPC_Response",
                                args: cargs,
                                rpc: nrpc,
                                src: tid,
                                dst: sidx,
                                desc:" from " + tid}
                    sopts.schedule(function() {
                        callback(tid, cargs);
                    }, 10, data);
                };
                var newSendRPC = (function () {
                    return function () {
                        origSendRPC(nsid, nrpc, nargs, ncallback);
                    };
                })();
                var data = {type: "RPC",
                            args: args,
                            rpc: rpc,
                            src: sidx,
                            dst: nsid,
                            desc: "to " + sid};
                sopts.schedule(newSendRPC, 10, data);
            };
            sopts.saveFn = function (data, callback) {
                var newSaveFn = (function () {
                    var ndata = data,
                        ncallback = callback;
                    return function () {
                        origSaveFn(ndata, ncallback);
                    };
                })();
                sopts.schedule(newSaveFn, 20, {type:"saveFn"});
            };
        })();
    }
}

function addServer(sid, opts) {
    opts = local.copyMap(opts);
    opts.listenAddress = "local:" + sid;
    return test_common.addServer(serverPool, sid, opts,
                                 local.RaftServerLocal);
}

function removeServer(sid) {
    test_common.removeServer(serverPool, sid);
}

function getAll(attr) {
    return test_common.getAll(serverPool, attr);
}
 
function getLeaderId() {
    return test_common.getLeaderId(serverPool);
}
