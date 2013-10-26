/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2013 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict";

if (typeof module === 'undefined') {
    var tasks = {},
        exports = tasks;
}

// An Task/Event Queue system. The primary methods are scheduling a task
// (schedule, scheduleRand), cancelling a task (cancel), and
// removing/executing the 
// cancelled, 
// Tasks are stored as an array of:
//   {id:     EVENT_ID,
//    action: ACTION_FUNCTION,
//    time:   MS_TIME,
//    type:   OPTIONAL_TYPE,
//    desc:   OPTIONAL_DESCRIPTION}
function Tasks() {
    var nextId = 1,
        curTime = 0,
        tasks = [],
        api = {};

    // Find the chronological position in the tasks queue for this
    // new event and insert it there. Returns the unique ID of this
    // task (for use with cancel).
    api.schedule = function(action, timeOffset, type, description) {
        var idx = tasks.length,
            tid = nextId++,
            time = curTime + timeOffset;
        // TODO: this should be binary search
        for (; idx > 0; idx--) {
            if (tasks[idx-1].time <= time) {
                break;
            }
        }
        tasks.splice(idx, 0, {id:     tid,
                              action: action,
                              time:   time,
                              type:   type,
                              desc:   description});
        return tid;
    };

    // Like schedule but picks a random timeOffset between min and max
    api.scheduleRand = function(action, min, max, type, description) {
        var timeOffset = Math.floor(Math.random() * (max - min) + min);
        return api.schedule(action, timeOffset, type, description);
    };

    // Remove the event with ID id from the tasks queue
    api.cancel = function(id) {
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === id) {
                tasks.splice(i,1);
                break;
            }
        }
    };

    // Return the event at the front of the tasks queue without
    // removing it
    api.current = function() {
        return tasks[0];
    }

    // Return the event queue
    api.dump = function() {
        return tasks;
    }

    // Return the event queue
    api.show = function() {
        console.log("Current time: " + curTime + "ms");
        for (var i = 0; i < tasks.length; i++) {
            var t = tasks[i],
                type = t.type || t.action.name,
                msg = t.time + "ms: " + t.id + " " + " [" + type + "]";
            if (t.desc) { msg += " " + t.desc; }
            console.log(msg);
        }
    }

    // Advanced the time to the next event in the queue, remove it,
    // and execute it's action. Returns the new "current" time.
    api.step = function() {
        var e = tasks.shift(),
            msg = "Executing event ID " + e.id;
        if (e.type) { msg += " [" + e.type + "]"; }
        if (e.desc) { msg += " " + e.desc; }
        console.log(msg);
        curTime = e.time;
        e.action();

        return curTime;
    };

    return api;
}

exports.Tasks = Tasks;
