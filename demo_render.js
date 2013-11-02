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

    var node_template = '\
<div class="name">{0}</div>\
<div class="state">{1}</div>\
<div class="term">T{2}</div>\
<div class="log">Log - {3} / {4}</div>';

var width = 500, height = 500;

var n1 = {id: "node_1", label: "Node 1", state: "leader"},
    n2 = {id: "node_2", label: "Node 2", state: "candidate"},
    n3 = {id: "node_3", label: "Node 3", state: "follower"},
    n4 = {id: "node_4", label: "Node 4", state: "follower"},
    n5 = {id: "node_5", label: "Node 5", state: "follower"},
    nodes = [n1, n2, n3, n4, n5],
    links = [{source:n1, target:n2, type:"green"}];

// Populate the fully interconnected dashed lines
for (var i=0; i < nodes.length; i++) {
    for (var j=i+1; j < nodes.length; j++) {
        links.push({source:nodes[i], target:nodes[j], type:"dashed"});
    }
}

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
    node = divs.selectAll(".node");

function update() {
    path = path.data(force.links());
    path.enter().append("svg:path")
        .attr("class", function(d) { return "link " + d.type; })
        .attr("marker-end", function(d) {
                console.log("here1");
                if (d.type === "dashed") {
                    return "";
                } else {
                    return "url(#" + d.type + ")";
                }
            });
    path.exit().remove();

    // define the nodes
    node = node.data(force.nodes());
    node.enter().append("div")
        .attr("class", function(d) {
                    return "node " + d.state;
                })
        .attr("id", function(d) { return d.id; })
        .html(function (d) {
                return node_template.format(
                    d.label, d.state, "3", "10", "15");
            })
        .call(force.drag);
    node.exit().remove();

    force.start();
}

update();

function addLink() {
    links.push({source:n2, target:n3, type:"green"});
    update();
}
function removeLink() {
    links.pop();
    update();
}
function removeAddLink() {
    links.pop();
    update();
    links.push({source:n1, target:n2, type:"red"});
    update();
}

var counter = 0;

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
}
