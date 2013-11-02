var serverPool = local._serverPool;
var idIdx = 0;
/*
var topts = {scheduleCallback: function(task) {
                     console.log("Scheduled:", task);
                },
             cancelCallback: function(task) {
                     console.log("Cancelled:", task);
                },
             finishCallback: function(task) {
                     console.log("Finished:", task);
                }
            };
*/
var topts = {};
var tqueue = tasks.Tasks(topts);

var stepButton = document.getElementById('stepButton'),
    taskList = document.getElementById('taskList'),
    messages = document.getElementById('messages');


function startServers(opts, n) {
    n = n || 5;
    var serverOpts = {};
    for (var i=0; i < n; i++) {
        serverOpts[i] = local.copyMap(opts);
        (function () {
            var sidx = i,
                sopts = serverOpts[i];
            sopts.verbose = true;
            sopts.listenAddress = "Node " + (idIdx++);
            sopts.schedule = function (action, time, type, desc) {
                desc = desc || "";
                desc += " / " + sopts.listenAddress;
                return tqueue.schedule(action, time, type, desc);
            };
            sopts.unschedule = function (id) {
                tqueue.cancel(id);
            };
            sopts.log = function() {
                var msg = Array.prototype.join.call(arguments, " ");
                msg = msg.replace(/^[0-9]*:/, tqueue.currentTime() + ":");
                messages.innerHTML += msg + "\n";
                messages.scrollTop = messages.scrollHeight;
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
                    sopts.schedule(function() {
                        callback(tid, cargs);
                    }, 10, nrpc+"_RPC_Response", " from " + tid);
                };
                var newSendRPC = (function () {
                    return function () {
                        origSendRPC(nsid, nrpc, nargs, ncallback);
                    };
                })();
                sopts.schedule(newSendRPC, 10, rpc+"_RPC", "to " + sid);
            };
            sopts.saveFn = function (data, callback) {
                var newSaveFn = (function () {
                    var ndata = data,
                        ncallback = callback;
                    return function () {
                        origSaveFn(ndata, ncallback);
                    };
                })();
                sopts.schedule(newSaveFn, 20, "saveFn");
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

function updateTaskList() {
    while (taskList.firstChild) {
          taskList.removeChild(taskList.firstChild);
    }
    var tasks = tqueue.dump();
    for (var i=0; i < tasks.length; i++) {
        var li = document.createElement('li');
        var t = tasks[i],
            type = t.type || t.action.name,
            msg = t.time + "ms: " + t.id + " " + " [" + type + "]";
        if (t.desc) { msg += " " + t.desc; }
        li.innerHTML = msg;
        taskList.appendChild(li);
    }
}

startServers({debug:true, verbose:true});
stepButton.onclick = function () {
    tqueue.step();
    updateTaskList();
};
updateTaskList();
