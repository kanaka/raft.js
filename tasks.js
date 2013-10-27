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

// An Task/Event Queue system. The primary methods are scheduling
// a task (schedule, scheduleRand), cancelling a task (cancel), and
// executing the next task.
// The opts map take the following keys:
//   - verbose: enable/disable verbose loggin
//   - scheduleCallback: called when a task is scheduled. Passed the
//     new task.
//   - cancelCallback: called when a task is cancelled. Passed the
//     cancelled task.
//   - startCallback: called right before a task is executed. Passed
//     the task that is about to run.
//   - finishCallback: called right after a task is executed. Passed
//     the task that just ran.
// Tasks are stored as an array of:
//   {id:     TASK_ID,
//    action: ACTION_FUNCTION,
//    time:   MS_TIME,
//    type:   OPTIONAL_TYPE,
//    desc:   OPTIONAL_DESCRIPTION}
function Tasks(opts) {
    var nextId = 1,
        curTime = 0,
        tasks = [],
        api = {};
    opts = opts || {};

    // Find the chronological position in the tasks queue for this
    // new task and insert it there. Returns the unique ID of this
    // task (for use with cancel).
    api.schedule = function(action, timeOffset, type, description) {
        var idx = tasks.length,
            tid = nextId++,
            time = curTime + timeOffset,
            task = {id:     tid,
                    action: action,
                    time:   time,
                    type:   type,
                    desc:   description};
        // TODO: this should be binary search
        for (; idx > 0; idx--) {
            if (tasks[idx-1].time <= time) {
                break;
            }
        }
        tasks.splice(idx, 0, task);
        if (opts.scheduleCallback) {
            opts.scheduleCallback(task);
        }
        return tid;
    };

    // Like schedule but picks a random timeOffset between min and max
    api.scheduleRand = function(action, min, max, type, description) {
        var timeOffset = Math.floor(Math.random() * (max - min) + min);
        return api.schedule(action, timeOffset, type, description);
    };

    // Remove the task with ID id from the tasks queue
    api.cancel = function(id) {
        var task = null;
        if (opts.verbose) {
            console.log("Cancelling task ID " + id);
        }
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === id) {
                task = tasks[i];
                tasks.splice(i,1);
                break;
            }
        }
        if (opts.cancelCallback && task) {
            opts.cancelCallback(task);
        }
    };

    // Return the task at the front of the tasks queue without
    // removing it
    api.current = function() {
        return tasks[0];
    };

    // Return the task queue
    api.dump = function() {
        return tasks;
    };

    // Return the task queue
    api.show = function() {
        console.log("Current time: " + curTime + "ms");
        for (var i = 0; i < tasks.length; i++) {
            var t = tasks[i],
                type = t.type || t.action.name,
                msg = t.time + "ms: " + t.id + " " + " [" + type + "]";
            if (t.desc) { msg += " " + t.desc; }
            console.log(msg);
        }
    };

    // Return the current time
    api.currentTime = function() {
        return currentTime;
    };

    //api.start(factor) {}
    //api.stop() {}

    // Advanced the time to the next task in the queue, remove it,
    // and execute it's action. Returns the new "current" time.
    api.step = function() {
        if (tasks.length === 0) {
            console.warn("Step called on empty tasks queue");
            return null;
        }
        var task = tasks.shift(),
            msg = "Executing task ID " + task.id;

        if (opts.startCallback) {
            opts.startCallback(task);
        }
        if (task.type) { msg += " [" + task.type + "]"; }
        if (task.desc) { msg += " " + task.desc; }
        if (opts.verbose) {
            console.log(msg);
        }
        curTime = task.time;
        task.action();

        if (opts.finishCallback) {
            opts.finishCallback(task);
        }
        return curTime;
    };

    return api;
}

exports.Tasks = Tasks;
