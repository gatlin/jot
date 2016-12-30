/* Base functions */
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var util = require('util');
var deepEqual = require('deep-equal');
function type_name(x) {
    if (typeof x === 'object') {
        if (Array.isArray(x)) {
            return 'array';
        }
        return 'object';
    }
    return typeof x;
}
// generic comparison function for many different types
function cmp(a, b) {
    if (type_name(a) !== type_name(b)) {
        return cmp(type_name(a), type_name(b));
    }
    else if (typeof a === 'number') {
        if (a < b) {
            return -1;
        }
        if (a > b) {
            return 1;
        }
        return 0;
    }
    else if (typeof a === 'string') {
        return a.localeCompare(b);
    }
    else if (Array.isArray(a)) {
        var x = cmp(a.length, b.length);
        if (x !== 0) {
            return x;
        }
        for (var i = 0; i < a.length; i++) {
            x = cmp(a[i], b[i]);
            if (x !== 0) {
                return x;
            }
        }
        return 0;
    }
    throw 'Type ' + type_name(a) + ' not comparable.';
}
exports.cmp = cmp;
var BaseOperation = (function () {
    function BaseOperation() {
    }
    BaseOperation.prototype.inspect = function (depth) {
        var repr = [];
        var keys = Object.keys(this);
        for (var i = 0; i < keys.length; i++) {
            var v = void 0;
            if (this[keys[i]] instanceof BaseOperation) {
                v = this[keys[i]].inspect(depth - 1);
            }
            else if (typeof this[keys[i]] !== 'undefined') {
                v = util.format("%j", this[keys[i]]);
            }
            else {
                continue;
            }
            repr.push(keys[i] + ':' + v);
        }
        return util.format('<%s.%s {%s}>', this.type[0], this.type[1], repr.join(', '));
    };
    BaseOperation.prototype.toJsonableObject = function () {
        var repr = {};
        repr['_type'] = { 'module': this.type[0], 'class': this.type[1] };
        var keys = Object.keys(this);
        for (var i = 0; i < keys.length; i++) {
            var v = void 0;
            if (this[keys[i]] instanceof BaseOperation) {
                v = this[keys[i]].toJsonableObject();
            }
            else if (keys[i] === 'ops' && Array.isArray(this[keys[i]])) {
                v = this[keys[i]].map(function (ki) { return ki.toJsonableObject(); });
            }
            else if (typeof this[keys[i]] !== 'undefined') {
                v = this[keys[i]];
            }
            else {
                continue;
            }
            repr[keys[i]] = v;
        }
        return repr;
    };
    BaseOperation.prototype.serialize = function () {
        return JSON.stringify(this.toJsonableObject());
    };
    BaseOperation.prototype.rebase = function (_other, conflictless) {
        if (conflictless === void 0) { conflictless = false; }
        if (this.op_name === 'NO_OP') {
            return this;
        }
        if (_other.op_name === 'NO_OP') {
            return this;
        }
        for (var i = 0; i < ((this.rebase_functions !== null)
            ? this.rebase_functions.length
            : 0); i++) {
            if (_other.op_name === this.rebase_functions[i][0]) {
                var r = this.rebase_functions[i][1].call(this, _other, conflictless);
                if (r !== null && r[0] !== null) {
                    return r[0];
                }
            }
        }
        for (var i = 0; i < ((_other.rebase_functions !== null)
            ? _other.rebase_functions.length
            : 0); i++) {
            if (this.op_name === _other.rebase_functions[i][0]) {
                var r = _other.rebase_functions[i][1].call(_other, this, conflictless);
                if (r !== null && r[1] !== null) {
                    return r[1];
                }
            }
        }
        return null;
    };
    return BaseOperation;
}());
exports.BaseOperation = BaseOperation;
function isSET(thing) {
    return thing instanceof SET;
}
var NO_OP = (function (_super) {
    __extends(NO_OP, _super);
    function NO_OP() {
        _super.call(this);
        this.rebase_functions = [];
        this.op_name = 'NO_OP';
        Object.freeze(this);
    }
    NO_OP.prototype.apply = function (document) {
        return document;
    };
    NO_OP.prototype.simplify = function () {
        return this;
    };
    NO_OP.prototype.invert = function () {
        return this;
    };
    NO_OP.prototype.compose = function (other) {
        return other;
    };
    return NO_OP;
}(BaseOperation));
exports.NO_OP = NO_OP;
var SET = (function (_super) {
    __extends(SET, _super);
    function SET(old_value, new_value) {
        var _this = this;
        if (new_value === void 0) { new_value = undefined; }
        _super.call(this);
        this.op_name = 'SET';
        this.rebase_functions = [
            ['SET', function (_other, conflictless) {
                    var other = _other;
                    if (deepEqual(_this.new_value, other.new_value)) {
                        return [new NO_OP(), new NO_OP()];
                    }
                    if (conflictless && cmp(_this.new_value, other.new_value) < 0) {
                        return [new NO_OP(), new SET(_this.new_value, other.new_value)];
                    }
                    return null;
                }],
            ['MATH', function (_other, conflictless) {
                    var other = _other;
                    try {
                        return [new SET(other.apply(_this.old_value), other.apply(_this.new_value)),
                            other
                        ];
                    }
                    catch (e) {
                        if (conflictless) {
                            return [
                                new SET(other.apply(_this.old_value), _this.new_value),
                                new NO_OP()
                            ];
                        }
                    }
                    return null;
                }]
        ];
        this.old_value = old_value;
        this.new_value = new_value;
        Object.freeze(this);
    }
    SET.prototype.apply = function (document) {
        return this.new_value;
    };
    SET.prototype.simplify = function () {
        if (deepEqual(this.old_value, this.new_value)) {
            return new NO_OP();
        }
        return this;
    };
    SET.prototype.invert = function () {
        return new SET(this.new_value, this.old_value);
    };
    SET.prototype.compose = function (other) {
        return new SET(this.old_value, other.apply(this.new_value))
            .simplify();
    };
    return SET;
}(BaseOperation));
exports.SET = SET;
var MATH = (function (_super) {
    __extends(MATH, _super);
    function MATH(operator, operand) {
        var _this = this;
        _super.call(this);
        this.op_name = 'MATH';
        this.rebase_functions = [
            ['MATH', function (_other, conflictless) {
                    var other = _other;
                    if (_this.operator === other.operator) {
                        if (_this.operator !== 'rot' ||
                            _this.operand[1] !== other.operand[1]) {
                            return [_this, _other];
                        }
                    }
                    if (conflictless) {
                        if (cmp([_this.operator, _this.operand], [other.operator, other.operand]) < 0) {
                            return [
                                _this,
                                new LIST([_this.invert(), _other, _this])
                            ];
                        }
                    }
                    return null;
                }]
        ];
        this.operator = operator;
        this.operand = operand;
        Object.freeze(this);
    }
    MATH.prototype.apply = function (document) {
        if (typeof document !== 'number' && typeof document !== 'boolean') {
            throw 'Invalid operation on non-numeric document';
        }
        if (this.operator === 'add') {
            return document + this.operand;
        }
        if (this.operator === 'rot') {
            return (document + this.operand[0]) % this.operand[1];
        }
        if (this.operator === 'mult') {
            return document * this.operand;
        }
        if (this.operator === 'xor') {
            var ret = document ^ this.operand;
            if (typeof document === 'boolean') {
                ret = !!ret;
            }
            return ret;
        }
    };
    MATH.prototype.simplify = function () {
        if (this.operator === 'add' && this.operand === 0) {
            return new NO_OP();
        }
        if (this.operator === 'rot' && this.operand[0] === 0) {
            return new NO_OP();
        }
        if (this.operator === 'rot') {
            return new MATH('rot', [this.operand[0] % this.operand[1],
                this.operand[1]]);
        }
        if (this.operator === 'mult' && this.operand === 1) {
            return new NO_OP();
        }
        if (this.operator === 'xor' && this.operand === 0) {
            return new NO_OP();
        }
        return this;
    };
    MATH.prototype.invert = function () {
        if (this.operator === 'add') {
            return new MATH('add', -this.operand);
        }
        if (this.operator === 'rot') {
            return new MATH('rot', [-this.operand[0], this.operand[1]]);
        }
        if (this.operator === 'mult') {
            return new MATH('mult', 1.0 / this.operand);
        }
        if (this.operator === 'xor') {
            return this;
        }
    };
    MATH.prototype.compose = function (other) {
        if (other instanceof NO_OP) {
            return this;
        }
        if (other instanceof SET) {
            var _other = other;
            return new SET(this.invert()
                .apply(_other.old_value), _other.new_value)
                .simplify();
        }
        if (other instanceof MATH) {
            var _other = other;
            if (this.operator === _other.operator) {
                if (this.operator === 'add') {
                    return new MATH('add', this.operand + _other.operand);
                }
                if (this.operator === 'rot') {
                    return new MATH('rot', [this.operand[0] + _other.operand[0],
                        this.operand[1]]).simplify();
                }
                if (this.operator === 'mult') {
                    return new MATH('mult', this.operand * _other.operand);
                }
                if (this.operator === 'xor') {
                    return new MATH('xor', this.operand ^ _other.operand);
                }
            }
        }
        return null;
    };
    return MATH;
}(BaseOperation));
exports.MATH = MATH;
function rebase_array(base, ops) {
    if (ops.length === 0 || base.length === 0) {
        return ops;
    }
    if (base instanceof Array) {
        for (var i = 0; i < base.length; i++) {
            ops = rebase_array(base[i], ops);
            if (!ops) {
                return null;
            }
        }
        return ops;
    }
    else {
        if (ops.length === 1) {
            var op = ops[0].rebase(base);
            if (!op) {
                return null; // conflict
            }
            return [op];
        }
        var op1 = ops[0];
        var op2 = ops.splice(1);
        var r1 = op1.rebase(base);
        if (!r1) {
            return null; // rebase failed
        }
        var r2 = base.rebase(op1);
        if (!r2) {
            return null; // rebase failed
        }
        var r3 = rebase_array(r2, op2);
        if (!r3) {
            return null; // rebase failed
        }
        return [r1].concat(r3);
    }
}
var LIST = (function (_super) {
    __extends(LIST, _super);
    function LIST(ops) {
        _super.call(this);
        this.op_name = 'LIST';
        this.rebase_functions = [];
        if (ops === null) {
            throw 'Invalid argument';
        }
        if (!(ops instanceof Array)) {
            throw 'Invalid argument';
        }
        this.ops = ops;
        Object.freeze(this);
    }
    LIST.prototype.apply = function (document) {
        for (var i = 0; i < this.ops.length; i++) {
            document = this.ops[i].apply(document);
        }
        return document;
    };
    LIST.prototype.simplify = function () {
        var new_ops = [];
        for (var i = 0; i < this.ops.length; i++) {
            var op = this.ops[i];
            if (op instanceof NO_OP) {
                continue;
            }
            if (new_ops.length === 0) {
                new_ops.push(op);
            }
            else {
                for (var j = new_ops.length - 1; j >= 0; j--) {
                    var c = new_ops[j].compose(op);
                    if (c) {
                        if (c instanceof NO_OP) {
                            new_ops.splice(j, 1);
                        }
                        else {
                            new_ops[j] = c;
                        }
                        break;
                    }
                    else {
                        if (j > 0) {
                            var r1 = op.rebase(new_ops[j].invert());
                            var r2 = new_ops[j].rebase(op);
                            if (r1 !== null && r2 !== null) {
                                op = r1;
                                new_ops[j] = r2;
                                continue;
                            }
                        }
                        new_ops.splice(j + 1, 0, op);
                        break;
                    }
                }
            }
        }
        if (new_ops.length === 0) {
            return new NO_OP();
        }
        return new LIST(new_ops);
    };
    LIST.prototype.invert = function () {
        var new_ops = [];
        for (var i = this.ops.length - 1; i >= 0; i--) {
            new_ops.push(this.ops[i].invert());
        }
        return new LIST(new_ops);
    };
    LIST.prototype.compose = function (_other) {
        if (this.ops.length === 0) {
            return new LIST([_other]);
        }
        if (_other instanceof NO_OP) {
            return this;
        }
        if (_other instanceof SET) {
            var other = _other;
            return other.simplify();
        }
        if (_other instanceof LIST) {
            var other = _other;
            if (other.ops.length === 0) {
                return this;
            }
            return new LIST(this.ops.concat(other.ops));
        }
        var new_ops = this.ops.slice();
        new_ops.push(_other);
        return new LIST(new_ops);
    };
    LIST.prototype.rebase = function (_other) {
        if (_other instanceof NO_OP) {
            return this;
        }
        var base;
        if (_other instanceof LIST) {
            var other = _other;
            base = other.ops;
        }
        else {
            base = _other;
        }
        var ops = rebase_array(base, this.ops);
        if (ops === null) {
            return null;
        }
        if (ops.length === 0) {
            return new NO_OP();
        }
        return new LIST(ops);
    };
    return LIST;
}(BaseOperation));
exports.LIST = LIST;
