/* Re-exports along with some name changes for compatibility with old
   module organization. */
"use strict";
var base_1 = require("./base");
exports.BaseOperation = base_1.BaseOperation;
exports.NO_OP = base_1.NO_OP;
exports.SET = base_1.SET;
exports.MATH = base_1.MATH;
exports.LIST = base_1.LIST;
var sequences_1 = require("./sequences");
exports.SPLICE = sequences_1.SPLICE;
exports.INS = sequences_1.INS;
exports.DEL = sequences_1.DEL;
exports.MAP = sequences_1.MAP;
exports.ARRAY_APPLY = sequences_1.APPLY;
var objects_1 = require("./objects");
exports.PUT = objects_1.PUT;
exports.REN = objects_1.REN;
exports.REM = objects_1.REM;
exports.OBJECT_APPLY = objects_1.APPLY;
var diff_1 = require("./diff");
exports.diff = diff_1.diff;
var values = require("./values");
var sequences = require("./sequences");
var objects = require("./objects");
var meta = require("./meta");
var ctor_table = {
    'values': {
        'NO_OP': function (obj) {
            return new values.NO_OP();
        },
        'SET': function (obj) {
            return new values.SET(obj.old_value, obj.new_value);
        },
        'MATH': function (obj) {
            return new values.MATH(obj.operator, obj.operand);
        }
    },
    'objects': {
        'PUT': function (obj) {
            return new objects.PUT(obj.key, obj.value);
        },
        'REM': function (obj) {
            return new objects.REM(obj.key, obj.old_value);
        },
        'REN': function (obj) {
            return new objects.REN(obj.old_key, obj.new_key);
        },
        'APPLY': function (obj) {
            return new objects.APPLY(obj.key, opFromJsonableObject(obj.op));
        }
    },
    'sequences': {
        'SPLICE': function (obj) {
            return new sequences.SPLICE(obj.pos, obj.old_value, obj.new_value);
        },
        'MOVE': function (obj) {
            return new sequences.MOVE(obj.pos, obj.count, obj.new_pos);
        },
        'APPLY': function (obj) {
            return new sequences.APPLY(obj.pos, opFromJsonableObject(obj.op));
        },
        'MAP': function (obj) {
            return new sequences.MAP(opFromJsonableObject(obj.op));
        }
    },
    'meta': {
        'LIST': function (obj) {
            return new meta.LIST(obj.ops.map(function (o) { return opFromJsonableObject(o); }));
        }
    }
};
function opFromJsonableObject(obj) {
    if (!('_type' in obj)) {
        throw 'Invalid argument: not an operation';
    }
    var module_name = obj['_type']['module'];
    var op_name = obj['_type']['class'];
    return ctor_table[module_name][op_name](obj);
}
exports.opFromJsonableObject = opFromJsonableObject;
function deserialize(op_json) {
    return opFromJsonableObject(JSON.parse(op_json));
}
exports.deserialize = deserialize;
function APPLY(pos_or_key, other) {
    if (typeof pos_or_key === 'number') {
        return new sequences.APPLY(pos_or_key, other);
    }
    if (typeof pos_or_key === 'string') {
        return new objects.APPLY(pos_or_key, other);
    }
    throw 'Invalid argument';
}
exports.APPLY = APPLY;
