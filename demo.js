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
    n = n || 3;
    var serverOpts = {};
    for (var i=0; i < 3; i++) {
        serverOpts[i] = local.copyMap(opts);
        serverOpts[i].verbose = true;
        serverOpts[i].listenAddress = "Node " + (idIdx++);
        serverOpts[i].schedule = (function () {
            var sopts = serverOpts[i],
                sidx = i;
            return function (action, time, type, desc) {
                desc = desc || "";
                desc += ", sid: " + sopts.listenAddress;
                return tqueue.schedule(action, time, type, desc);
            }
        })();
        serverOpts[i].unschedule = function (id) {
            tqueue.cancel(id);
        };
        serverOpts[i].log = function() {
            var msg = Array.prototype.join.call(arguments, " ");
            msg = msg.replace(/^[0-9]*:/, tqueue.currentTime() + ":");
            messages.innerHTML += msg + "\n";
            messages.scrollTop = messages.scrollHeight;
        };
    }
    // Create the servers
    var ret = test_common.startServers(serverPool, serverOpts,
                                       local.RaftServerLocal);
    // Wrap the sendRPC with a scheduled version
    // Note the double closures: one for the sendRPC and one inside
    // that for the wrapped callback response
    for (var i=0; i < 3; i++) {
        serverOpts[i].sendRPC = (function () {
            var origSendRPC = serverOpts[i].sendRPC;
            return function (sid, rpc, args, callback) {
                var newSendRPC = (function () {
                    return function () {
                        var nsid = sid,
                            nrpc = rpc,
                            nargs = args,
                            ncallback;
                        ncallback = function (tid, cargs) {
                            tqueue.schedule(function() {
                                callback(tid, cargs);
                            }, 10, nrpc+"_RPC_Response");
                        };
                        origSendRPC(nsid, nrpc, nargs, ncallback);
                    };
                })();
                tqueue.schedule(newSendRPC, 10, rpc+"_RPC");
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
