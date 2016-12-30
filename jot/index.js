/* Re-exports along with some name changes for compatibility with old
   module organization. */
"use strict";
var base_1 = require('./base');
exports.BaseOperation = base_1.BaseOperation;
exports.NO_OP = base_1.NO_OP;
exports.SET = base_1.SET;
exports.MATH = base_1.MATH;
exports.LIST = base_1.LIST;
var sequences_1 = require('./sequences');
exports.SPLICE = sequences_1.SPLICE;
exports.INS = sequences_1.INS;
exports.DEL = sequences_1.DEL;
exports.MAP = sequences_1.MAP;
exports.ARRAY_APPLY = sequences_1.APPLY;
var objects_1 = require('./objects');
exports.PUT = objects_1.PUT;
exports.REN = objects_1.REN;
exports.REM = objects_1.REM;
exports.OBJECT_APPLY = objects_1.APPLY;
