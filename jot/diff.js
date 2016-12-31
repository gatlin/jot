"use strict";
var deepEqual = require("deep-equal");
var values = require("./values");
var meta = require("./meta");
var objects = require("./objects");
var sequences = require("./sequences");
// Run the diff method appropriate for the pair of data types.
function typename(val) {
    if (val === null) {
        return "null";
    }
    if (typeof val === "string" ||
        typeof val === "number" ||
        typeof val === "boolean") {
        return typeof val;
    }
    if (Array.isArray(val)) {
        return "array";
    }
    return "object";
}
var d;
function _diff(a, b, options) {
    // Compares two JSON-able data instances and returns
    // information about the difference:
    //
    // {
    //   op:   a JOT operation representing the change from a to b
    //   pct:  a number from 0 to 1 representing the proportion
    //         of content that is different
    //   size: an integer representing the approximate size of the
    //         content in characters, which is used for weighting
    // }
    // Return fast if the objects are equal. This is muuuuuch
    // faster than doing our stuff recursively.
    if (deepEqual(a, b)) {
        return {
            op: new values.NO_OP(),
            pct: 0.0,
            size: JSON.stringify(a).length
        };
    }
    var ta = typename(a);
    var tb = typename(b);
    if (ta === "string" && tb === "string") {
        return diff_strings(a, b, options);
    }
    if (ta === "array" && tb === "array") {
        return diff_arrays(a, b, options);
    }
    if (ta === "object" && tb === "object") {
        return diff_objects(a, b, options);
    }
    // If the data types of the two values are different,
    // or if we don't recognize the data type (which is
    // not good), then only an atomic SET operation is possible.
    return {
        op: new values.SET(a, b),
        pct: 1.0,
        size: (JSON.stringify(a) + JSON.stringify(b)).length / 2
    };
}
function diff(a, b, options) {
    if (options === void 0) { options = undefined; }
    options = options || {};
    return _diff(a, b, options).op;
}
exports.diff = diff;
function diff_strings(a, b, options) {
    // Use the 'diff' package to compare two strings and convert
    // the output to a jot.LIST.
    var diff = require("diff");
    var method = "Chars";
    if (options.words) {
        method = "Words";
    }
    if (options.lines) {
        method = "Lines";
    }
    if (options.sentences) {
        method = "Sentences";
    }
    var index = 0;
    var total_content = 0;
    var changed_content = 0;
    var ops = diff["diff" + method](a, b)
        .map(function (change) {
        var ret = null;
        var old_value = "", new_value = "";
        // Increment counter of total characters encountered.
        total_content += change.value.length;
        if (change.added || change.removed) {
            // Create an INS or DEL operation for this change.
            if (change.removed)
                old_value = change.value;
            if (change.added)
                new_value = change.value;
            ret = new sequences.SPLICE(index, old_value, new_value);
            // Increment counter of changed characters.
            changed_content += change.value.length;
        }
        // Advance character position index.
        if (!change.removed)
            index += change.value.length;
        return ret;
    })
        .filter(function (item) { return item != null; });
    // Merge consecutive INS/DELs into SPLICES.
    var op = new meta.LIST(ops).simplify();
    // If the change is a single operation that replaces the whole content
    // of the string, use a SET operation rather than a SPLICE operation.
    if (op instanceof sequences.SPLICE) {
        var _op = op;
        if (_op.old_value == a && _op.new_value == b) {
            return {
                op: new values.SET(a, b),
                pct: 1.0,
                size: total_content
            };
        }
    }
    return {
        op: op,
        pct: (changed_content + 1) / (total_content + 1),
        // zero
        size: total_content
    };
}
function diff_arrays(a, b, options) {
    // Use the 'generic-diff' package to compare two arrays,
    // but using a custom equality function. This gives us
    // a relation between the elements in the arrays. Then
    // we can compute the operations for the diffs for the
    // elements that are lined up (and INS/DEL operations
    // for elements that are added/removed).
    var generic_diff = require("generic-diff");
    // We'll run generic_diff over an array of indices
    // into a and b, rather than on the elements themselves.
    var ai = a.map(function (item, i) { return i; });
    var bi = b.map(function (item, i) { return i; });
    var ops = [];
    var total_content = 0;
    var changed_content = 0;
    var pos = 0;
    function do_diff(ai, bi, level) {
        // Run generic-diff using a custom equality function that
        // treats two things as equal if their difference percent
        // is less than or equal to level.
        //
        // We get back a sequence of add/remove/equal operations.
        // Merge these into changed/same hunks.
        var hunks = [];
        var a_index = 0;
        var b_index = 0;
        generic_diff(ai, bi, function (ai, bi) {
            return _diff(a[ai], b[bi], options).pct <= level;
        }).forEach(function (change) {
            if (!change.removed && !change.added) {
                // Same.
                if (a_index + change.items.length > ai.length)
                    throw "out of range";
                if (b_index + change.items.length > bi.length)
                    throw "out of range";
                hunks.push({ type: 'equal', ai: ai.slice(a_index, a_index + change.items.length), bi: bi.slice(b_index, b_index + change.items.length) });
                a_index += change.items.length;
                b_index += change.items.length;
            }
            else {
                if (hunks.length == 0 || hunks[hunks.length - 1].type == 'equal')
                    hunks.push({ type: 'unequal', ai: [], bi: [] });
                if (change.added) {
                    // Added.
                    hunks[hunks.length - 1].bi = hunks[hunks.length - 1].bi.concat(change.items);
                    b_index += change.items.length;
                }
                else if (change.removed) {
                    // Removed.
                    hunks[hunks.length - 1].ai = hunks[hunks.length - 1].ai.concat(change.items);
                    a_index += change.items.length;
                }
            }
        });
        // Process each hunk.
        hunks.forEach(function (hunk) {
            //console.log(level, hunk.type, hunk.ai.map(function(i) { return a[i]; }), hunk.bi.map(function(i) { return b[i]; }));
            if (level < 1 && hunk.ai.length > 0 && hunk.bi.length > 0
                && (level > 0 || hunk.type == "unequal")) {
                // Recurse at a less strict comparison level to
                // tease out more correspondences. We do this both
                // for 'equal' and 'unequal' hunks because even for
                // equal the pairs may not really correspond when
                // level > 0.
                do_diff(hunk.ai, hunk.bi, (level + 1.1) / 2);
                return;
            }
            if (hunk.type == "unequal") {
                var op = new sequences.SPLICE(pos, hunk.ai.map(function (i) { return a[i]; }), hunk.bi.map(function (i) { return b[i]; }));
                ops.push(op);
                //console.log(op);
                // Increment counters.
                var dd = (JSON.stringify(op.old_value) +
                    JSON.stringify(op.new_value)).length / 2;
                total_content += dd;
                changed_content += dd;
            }
            else {
                // The items in the arrays are in correspondence.
                // They may not be identical, however, if level > 0.
                if (hunk.ai.length != hunk.bi.length) {
                    throw "should be same length";
                }
                for (var i = 0; i < hunk.ai.length; i++) {
                    var d = _diff(a[hunk.ai[i]], b[hunk.bi[i]], options);
                    // Add an operation.
                    if (!(d.op instanceof values.NO_OP)) {
                        if (typeof hunk.bi[i] === 'number') {
                            ops.push(new sequences.APPLY(hunk.bi[i], d.op));
                        }
                        if (typeof hunk.bi[i] === 'string') {
                            ops.push(new objects.APPLY(hunk.bi[i], d.op));
                        }
                    }
                    // Increment counters.
                    total_content += d.size;
                    changed_content += d.size * d.pct;
                }
            }
            pos += hunk.bi.length;
        });
    }
    // Go.
    do_diff(ai, bi, 0);
    return {
        op: new meta.LIST(ops).simplify(),
        pct: (changed_content + 1) / (total_content + 1),
        // zero
        size: total_content
    };
}
function diff_objects(a, b, options) {
    // Compare two objects.
    var ops = [];
    var total_content = 0;
    var changed_content = 0;
    var d;
    // If a key exists in both objects, then assume the key
    // has not been renamed.
    for (var key in a) {
        if (key in b) {
            // Compute diff.
            d = _diff(a[key], b[key], options);
            // Add operation if there were any changes.
            if (!(d.op instanceof values.NO_OP)) {
                var ap = new objects.APPLY(key, d.op);
                ops.push(ap);
            }
            // Increment counters.
            total_content += d.size;
            changed_content += d.size * d.pct;
        }
    }
    // Do comparisons between all pairs of unmatched
    // keys to see what best lines up with what. Don't
    // store pairs with nothing in common.
    var pairs = [];
    for (var key1 in a) {
        if (key1 in b) {
            continue;
        }
        for (var key2 in b) {
            if (key2 in a) {
                continue;
            }
            var d_1 = _diff(a[key1], b[key2], options);
            if (d_1.pct == 1) {
                continue;
            }
            pairs.push({
                a_key: key1,
                b_key: key2,
                diff: d_1
            });
        }
    }
    // Sort the pairs to choose the best matches first.
    // (This is a greedy approach. May not be optimal.)
    var used_a = {};
    var used_b = {};
    pairs.sort(function (a, b) {
        return ((a.diff.pct * a.diff.size) -
            (b.diff.pct * b.diff.size));
    });
    pairs.forEach(function (item) {
        // Have we already generated an operation renaming
        // the key in a or renaming something to the key in b?
        // If so, this pair can't be used.
        if (item.a_key in used_a) {
            return;
        }
        if (item.b_key in used_b) {
            return;
        }
        used_a[item.a_key] = 1;
        used_b[item.b_key] = 1;
        // Use this pair.
        ops.push(new objects.REN(item.a_key, item.b_key));
        if (!(item.diff.op instanceof values.NO_OP)) {
            var ap = void 0;
            if (typeof item.b_key === 'string') {
                ap = new objects.APPLY(item.b_key, item.diff.op);
            }
            if (typeof item.b_key === 'number') {
                ap = new sequences.APPLY(item.b_key, item.diff.op);
            }
            ops.push(ap);
        }
        // Increment counters.
        total_content += item.diff.size;
        changed_content += item.diff.size * item.diff.pct;
    });
    // Delete/create any keys that didn't match up.
    for (var key in a) {
        if (key in b || key in used_a) {
            continue;
        }
        ops.push(new objects.REM(key));
    }
    for (var key in b) {
        if (key in a || key in used_b) {
            continue;
        }
        ops.push(new objects.PUT(key, b[key]));
    }
    return {
        op: new meta.LIST(ops).simplify(),
        pct: (changed_content + 1) / (total_content + 1),
        size: total_content
    };
}
