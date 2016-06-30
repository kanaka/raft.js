// String format function: http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format/4673436#4673436
if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) { 
            return typeof args[number] != 'undefined'
                ? args[number]
                : match;
        });
    };
}

function padNum(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

var width = 500, height = 500;

var nodes = [], links = [];

var stepButton = document.getElementById('stepButton'),
    taskList = document.getElementById('taskList'),
    messages = document.getElementById('messages');


var node_template = '\
<div class="name">{0}</div>\
<div class="state">{1}</div>\
<div class="term">{2}</div>\
<div class="log">Log - {3} / {4}</div>';

//
// d3.js specific
//

// Size the svg area for displaying the links
var svg = d3.select('#svg')
    .attr('width', width)
    .attr('height', height);

// Size the div area for displaying the nodes
var divs = d3.select('#divs')
    .attr('style', function(d) { return 'width: ' + width + 'px; height: ' + height + 'px;'; });

// Per-type markers, as they don't inherit styles.
svg.append("svg:defs").selectAll("marker")
    .data(["plain", "green", "dashed", "red"])
.enter().append("svg:marker")
    .attr("id", String)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 5)
    //.attr("refY", -1.5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
.append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");

var force = d3.layout.force()
    .nodes(nodes)
    .links(links)
    .size([width, height])
    .linkDistance(275)
    .charge(-300)
    .on("tick", tick);

var path = svg.append("svg:g").selectAll("path"),
    label = svg.selectAll("text"),
    node = divs.selectAll(".node");

function tick() {
    if (!node[0][0]) {
        return;
    }

    var ox = node[0][0].offsetWidth / 2,
        oy = node[0][0].offsetHeight / 2;

    node.attr('style', function(d) {
        return 'left: ' + (d.x - ox) + 'px; top: ' + (d.y - oy) + 'px;';
    });

    path.attr("d", function(d) {
        var tx = d.target.x,
            ty = d.target.y,
            sx = d.source.x,
            sy = d.source.y;
        if (d.type === "dashed") {
            return [
                "M",sx,sy,
                "L",tx,ty,
            ].join(" ");
        } else {
            return [
                "M",sx,sy,
                "L",(sx+tx)/2,(sy+ty)/2
            ].join(" ");
        }
    });

    label.attr("x", function(d) {
                //return (d.source.x*2 + d.target.x)/3;
                return (d.source.x*1.5 + d.target.x)/2.5;
            })
         .attr("y", function(d) {
                //return (d.source.y*2 + d.target.y)/3;
                return (d.source.y*1.5 + d.target.y)/2.5;
            });
}

function updateD3() {
    // Links (connections and RPCs)
    path = path.data(force.links());
    // Add
    path.enter().append("svg:path");
    path.attr("class", function(d) { return "link " + d.type; })
        .attr("marker-end", function(d) {
                if (d.type === "dashed") {
                    return "";
                } else {
                    return "url(#" + d.type + ")";
                }
            });
    // Remove
    path.exit().remove();


    // Links (connections and RPCs)
    label = label.data(force.links());
    // Add
    label.enter().append("text");
    label.attr("font-size", "0.75em")
         .attr("fill", "black")
         .text(function (d) {
            if (!d.task || !'rpc' in d.task.data) { return ""; }
            var tdata = d.task.data, targs = tdata.args,
                txt = tdata.rpc;
            switch (tdata.rpc + "_" + tdata.type) {
            case 'requestVote_RPC':
                txt += " (" + targs.term;
                txt += "," + targs.candidateId;
                txt += "," + targs.lastLogIndex;
                txt += "," + targs.lastLogTerm + ")";
                break;
            case 'appendEntries_RPC':
                txt += " (" + targs.term;
                txt += "," + targs.leaderId;
                txt += "," + targs.prevLogIndex;
                txt += "," + targs.prevLogTerm;
                txt += ",{" + targs.entries.length + "}";
                txt += "," + targs.commitIndex + ")";
                break;
            case 'requestVote_RPC_Response':
                txt += " Rsp (" + targs.term;
                txt += "," + targs.voteGranted + ")";
                break;
            case 'appendEntries_RPC_Response':
                txt += " Rsp (" + targs.term;
                txt += "," + targs.success + ")";
                break;
            }
            return txt;
        })
    // Remove
    label.exit().remove();



    // Nodes
    node = node.data(force.nodes());
    // Add
    node.enter().append("div")
        .attr("id", function(d) { return "node" + d.id; })
        .call(force.drag);
    // Update
    node.attr("class", function(d) {
                    return "node " + d.state;
                })
        .html(function (d) {
                var id = d.id;
                return node_template.format(
                    d._serverMap[id], d.state, "T" + d.currentTerm,
                    d.commitIndex+1, d.log.length);
            });
    // Remove
    node.exit().remove();

    force.start();
}

function updateTasks() {
    while (taskList.firstChild) {
          taskList.removeChild(taskList.firstChild);
    }
    var tasks = tqueue.dump();
    for (var i=0; i < tasks.length; i++) {
        var li = document.createElement('li');
        var t = tasks[i],
            d = t.data,
            time = padNum(t.time, 4, "0"),
            msg;
        msg = t.id + "@" + time + "ms: " + " [" + d.id;
        if (d.rpc) { msg += " " + d.rpc; }
        msg += " " + d.type + "]";
        if (d.desc) { msg += " " + d.desc; }
        li.innerHTML = msg;
        taskList.appendChild(li);
    }
}

// Register callback functions to monitor changes to the task queue
tqueueOpts.scheduleCallback = function(task) {
    if (task.data.rpc) {
        var src = serverPool[task.data.src],
            dst = serverPool[task.data.dst],
            type;
        if (task.data.type === 'RPC') {
            type = "green";
        } else {
            type = "red";
        }
        links.push({task_id: task.id,
                    task: task,
                    type: type,
                    source: src,
                    target: dst});
        console.log("schedule RPC:", task);
    }
};
tqueueOpts.finishCallback = function(task) {
    if (task.data.rpc) {
        console.log("finish RPC:", task);
        for (var i = links.length-1; i >= 0; i--) {
            if (links[i].task_id === task.id) {
                links.splice(i, 1);
                break;
            }
        }
    }
};
tqueueOpts.cancelCallback = tqueueOpts.finishCallback;

startServers({debug:true, verbose:1}, 5, function (msg) {
    messages.innerHTML += msg + "\n";
    messages.scrollTop = messages.scrollHeight;
});

// Populate the nodes from the serverPool
for (var k in serverPool) {
    nodes.push(serverPool[k]);
}

// Populate the fully interconnected dashed lines
for (var i=0; i < nodes.length; i++) {
    for (var j=i+1; j < nodes.length; j++) {
        links.push({source:nodes[i], target:nodes[j], type:"dashed"});
    }
}


stepButton.onclick = function () {
    tqueue.step();
    updateTasks();
    updateD3();
};

updateTasks();
updateD3();

