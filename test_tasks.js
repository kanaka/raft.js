if (typeof module !== 'undefined') {
    var copyMap = require('./base').copyMap,
        RaftServerLocal = require('./local').RaftServerLocal,
        test_common = require('./test_common'),
        tasks = require('./tasks')
        tests = require('./tests')
} else {
    var test_tasks = {},
        exports = test_tasks
}

var serverPool = {}
var serverStore = {}
var serverIdx = 0
var tqueueOpts = {}
var tqueue = tasks.Tasks(tqueueOpts)

function RaftServerTasks(id, opts) {
    if (!(this instanceof RaftServerTasks)) {
        // Handle instantiation without "new"
        return new RaftServerTasks(id, opts)
    }

    // Call the superclass
    RaftServerLocal.call(this, id, opts)

    if (!opts.serverStore || !opts.taskQueue) {
        throw new Error("opts.serverStore and opts.taskQueue required")
    }
}
RaftServerTasks.prototype = Object.create(RaftServerLocal.prototype)
RaftServerTasks.prototype.constructor = RaftServerTasks

RaftServerTasks.prototype.schedule = function(action, time, data) {
    data = data || {}
    data.type = data.type || action.name
    data.id = this._opts.listenAddress
    data.idx = this.id
    return this._opts.taskQueue.schedule(action, time, data)
}

RaftServerTasks.prototype.unschedule = function(id) {
    this._opts.taskQueue.cancel(id)
}

RaftServerTasks.prototype.logFn = function(id) {
    var msg = Array.prototype.join.call(arguments, " ")
    msg = msg.replace(/^[0-9]*:/, this._opts.taskQueue.currentTime() + ":")
    this._opts.msgCallback(msg)
}


function startServers(opts, n, msgCallback) {
    n = n || 5
    msgCallback = msgCallback ||
                  function(msg) { console.log.call(console, msg); }
    var serverOpts = {}
    for (var i=0; i < n; i++) {
        serverOpts[i] = copyMap(opts)
        serverOpts[i].serverPool = serverPool
        serverOpts[i].serverStore = serverStore
        serverOpts[i].listenAddress = "Node " + (serverIdx++)
        serverOpts[i].taskQueue = tqueue
        serverOpts[i].msgCallback = msgCallback
        serverOpts[i].durable = false
    }

    // Start the servers with a full cluster config by pre-configuring
    // the full configuration in the log so that each node will be
    // aware of it on start. Normally the cluster would start with
    // a single member and add one server at a time.
    var startLog = [{"term":0,"command":null}]
    var oldServers = []
    for (var i=0; i < n; i++) {
        startLog.push({term: 0,
                       oldServers: oldServers.slice(0),
                       newServer: i})
        oldServers.push(i)
    }
    for (var i=0; i < n; i++) {
        serverStore[i] = {"currentTerm": 0,
                          "votedFor":    null,
                          "log":         startLog}
    }

    // Create the servers
    var ret = test_common.startServers(RaftServerTasks, serverOpts)

    // Wrap the sendRPC and applyCmd with a scheduled version
    // Note the double closures: one for the sendRPC and one inside
    // that for the wrapped callback response
    for (var i=0; i < n; i++) {
        (function () {
            var sidx = i,
                server = serverPool[i],
                origSendRPC = server.sendRPC.bind(server),
                origSaveFn = server.saveFn.bind(server)
            server.sendRPC = function (sid, rpc, args, callback) {
                var nsid = sid,
                    nrpc = rpc,
                    nargs = args
                var newSendRPC = (function () {
                    return function () {
                        origSendRPC(nsid, nrpc, nargs)
                    }
                })()
                var data = {type: "RPC",
                            args: args,
                            rpc: rpc,
                            src: sidx,
                            dst: nsid,
                            desc: "to " + sid}
                server.schedule(newSendRPC, 10, data)
            }
            server.saveFn = function (data, callback) {
                var newSaveFn = (function () {
                    var ndata = data,
                        ncallback = callback
                    return function () {
                        origSaveFn(ndata, ncallback)
                    }
                })()
                server.schedule(newSaveFn, 20, {type:"saveFn"})
            }
        })()
    }
}

if (typeof require !== 'undefined' && require.main === module) {
    var taskPollMS = 1,
        runStepsMax = 100
    // Poll for tasks every taskPollMS and run up to runStepsMax steps
    // each time we poll
    function runTasks() {
        var cnt = 0
        setTimeout(runTasks, taskPollMS)
        while (cnt < runStepsMax && tqueue.dump().length > 0) {
            tqueue.step()
            cnt += 1
        }
    }
    runTasks()

    startServers()
    tests.test1(serverPool)
} else {
    exports.serverPool = serverPool
    exports.startServers = startServers
}
