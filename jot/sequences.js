"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var deepEqual = require('deep-equal');
var base_1 = require('./base');
var SPLICE = (function (_super) {
    __extends(SPLICE, _super);
    function SPLICE(pos, old_value, new_value) {
        var _this = this;
        _super.call(this);
        this._type = ['sequences', 'SPLICE'];
        this.rebase_functions = [
            ['SPLICE', function (_other, conflictless) {
                    if (_other instanceof SPLICE) {
                        var other = _other;
                        if (deepEqual(_this, other)) {
                            return [new base_1.NO_OP(), new base_1.NO_OP()];
                        }
                        // Two insertions at the same location.
                        if (_this.pos == other.pos && _this.old_value.length == 0 &&
                            other.old_value.length == 0) {
                            if (conflictless && base_1.cmp(_this.new_value, other.new_value)
                                < 0) {
                                return [_this, new exports.SPLICE(other.pos +
                                        _this.new_value.length, other.old_value, other.new_value)];
                            }
                            return null;
                        }
                        else if (_this.pos == other.pos && _this.old_value.length ==
                            other.old_value.length) {
                            if (conflictless && base_1.cmp(_this.new_value, other.new_value) <
                                0) {
                                return [
                                    new base_1.NO_OP(),
                                    new SPLICE(other.pos, _this.new_value, other.new_value)
                                ];
                            }
                            return null;
                        }
                        else if (_this.pos + _this.old_value.length <= other.pos)
                            return [
                                _this,
                                new exports.SPLICE(other.pos + (_this.new_value.length -
                                    _this.old_value.length), other.old_value, other.new_value)];
                        else if (conflictless
                            && ((_this.pos < other.pos) || (_this.pos == other.pos &&
                                _this.old_value.length >
                                    other.old_value.length))
                            && ((_this.pos + _this.old_value.length > other.pos +
                                other.old_value.length)
                                || ((_this.pos + _this.old_value.length == other.pos +
                                    other.old_value.length) && _this.pos < other.pos))) {
                            return [
                                new SPLICE(_this.pos, concat3(_this.old_value.slice(0, other.pos - _this.pos), other.new_value, _this.old_value.slice(other.pos +
                                    other.old_value.length -
                                    _this.pos)), _this.new_value),
                                // other gets clobbered
                                new base_1.NO_OP(),
                            ];
                        }
                        else if (conflictless && _this.pos < other.pos) {
                            return [
                                new SPLICE(_this.pos, _this.old_value.slice(0, other.pos - _this.pos), _this.new_value),
                                new SPLICE(_this.pos + _this.new_value.length, other.old_value.slice(_this.pos +
                                    _this.old_value.length - other.pos), other.new_value)
                            ];
                        }
                    }
                }],
            ['MOVE', function (_other, conflictless) {
                    if (_other instanceof MOVE) {
                        var other = _other;
                        if (_this.pos + _this.old_value.length < other.pos) {
                            return [
                                new SPLICE(map_index(_this.pos, other), _this.old_value, _this.new_value),
                                new MOVE(other.pos + _this.new_value.length -
                                    _this.old_value.length, other.count, other.new_pos)
                            ];
                        }
                        if (_this.pos >= other.pos + other.count) {
                            return [
                                new SPLICE(map_index(_this.pos, other), _this.old_value, _this.new_value),
                                other
                            ];
                        }
                    }
                }],
            ['APPLY', function (_other, conflictless) {
                    if (_other instanceof APPLY) {
                        var other = _other;
                        // other is after the spliced range
                        if (other.pos >= _this.pos + _this.old_value.length) {
                            return [_this, new exports.APPLY(other.pos +
                                    _this.new_value.length - _this.old_value, other.op)];
                        }
                        // other is before the spliced range
                        if (other.pos < _this.pos) {
                            return [_this, other];
                        }
                        var old_value = concat3(_this.old_value.slice(0, other.pos - _this.pos), unelem(other.op.apply(elem(_this.old_value, other.pos -
                            _this.pos)), _this.old_value), _this.old_value.slice(other.pos - _this.pos + 1));
                        if (_this.new_value.length == _this.old_value.length) {
                            try {
                                var new_value = concat3(_this.new_value.slice(0, other.pos - _this.pos), unelem(other.op.apply(elem(_this.new_value, other.pos
                                    - _this.pos)), _this.old_value), _this.new_value.slice(other.pos - _this.pos + 1));
                                return [
                                    new exports.SPLICE(_this.pos, old_value, new_value),
                                    other
                                ];
                            }
                            catch (e) {
                            }
                        }
                        // Otherwise, in conflictless mode, the SPLICE takes precedence.
                        if (conflictless) {
                            return [
                                new SPLICE(_this.pos, old_value, _this.new_value),
                                new base_1.NO_OP()
                            ];
                        }
                    }
                    return null;
                }],
            ['MAP', function (_other, conflictless) {
                    if (_other instanceof MAP) {
                        var other = _other;
                        try {
                            // If this is possible...
                            return [
                                new SPLICE(_this.pos, other.apply(_this.old_value), other.apply(_this.new_value)),
                                other
                            ];
                        }
                        catch (e) {
                            if (conflictless)
                                return [
                                    new SPLICE(_this.pos, other.apply(_this.old_value), _this.new_value),
                                    new base_1.NO_OP()
                                ];
                        }
                        // Can't resolve conflict.
                        return null;
                    }
                    return null;
                }]
        ];
        if (pos === null || old_value === null || new_value === null) {
            throw 'Invalid argument';
        }
        this.pos = pos;
        this.old_value = old_value;
        this.new_value = new_value;
        Object.freeze(this);
    }
    SPLICE.prototype.apply = function (document) {
        return concat3(document.slice(0, this.pos), this.new_value, document.slice(this.pos + this.old_value.length));
    };
    SPLICE.prototype.simplify = function () {
        if (deepEqual(this.old_value, this.new_value)) {
            return new base_1.NO_OP();
        }
        return this;
    };
    SPLICE.prototype.invert = function () {
        return new SPLICE(this.pos, this.new_value, this.old_value);
    };
    SPLICE.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof SPLICE) {
            var other = _other;
            if (this.pos <= other.pos &&
                other.pos + other.old_value.length <=
                    this.pos + this.new_value.length) {
                return new SPLICE(this.pos, this.old_value, concat3(this.new_value.slice(0, other.pos - this.pos), other.new_value, this.new_value.slice(this.new_value.length +
                    (other.pos + other.old_value.length) -
                    (this.pos + this.new_value.length))));
            }
            if (other.pos <= this.pos &&
                this.pos + this.new_value.length <=
                    other.pos + other.old_value.length) {
                return new SPLICE(other.pos, concat3(other.old_value.slice(0, this.pos - other.pos), this.old_value, other.old_value.slice(other.old_value.length + (this.pos
                    + this.new_value.length) - (other.pos +
                    other.old_value.length))), other.new_value);
            }
        }
        if (_other instanceof exports.APPLY) {
            var other = _other;
            if (other.pos >= this.pos && other.pos
                < this.pos + this.old_value.length) {
                return new exports.SPLICE(this.pos, this.old_value, concat3(this.new_value.slice(0, other.pos - this.pos), unelem(other.apply(elem(this.new_value, other.pos -
                    this.pos)), this.old_value), this.new_value.slice(other.pos - this.pos + 1)))
                    .simplify();
            }
        }
        return null;
    };
    return SPLICE;
}(base_1.BaseOperation));
exports.SPLICE = SPLICE;
var INS = (function (_super) {
    __extends(INS, _super);
    function INS(pos, value) {
        _super.call(this, pos, value.slice(0, 0), value);
    }
    return INS;
}(SPLICE));
exports.INS = INS;
var DEL = (function (_super) {
    __extends(DEL, _super);
    function DEL(pos, old_value) {
        _super.call(this, pos, old_value, old_value.slice(0, 0));
    }
    return DEL;
}(SPLICE));
exports.DEL = DEL;
var MOVE = (function (_super) {
    __extends(MOVE, _super);
    function MOVE(pos, count, new_pos) {
        var _this = this;
        _super.call(this);
        this._type = ['sequences', 'MOVE'];
        this.rebase_functions = [
            ['MOVE', function (_other, conflictless) {
                    if (_other instanceof MOVE) {
                        var other = _other;
                        if (_this.pos + _this.count >= other.pos && _this.pos < other.pos +
                            other.count)
                            return null;
                        return [
                            new exports.MOVE(map_index(_this.pos, other), _this.count, map_index(_this.new_pos, other)),
                            null
                        ];
                    }
                    return null;
                }],
            ['APPLY', function (_other, conflictless) {
                    if (_other instanceof APPLY) {
                        var other = _other;
                        return [
                            _this,
                            new APPLY(map_index(other.pos, _this), other.op)
                        ];
                    }
                    return null;
                }],
            ['MAP', function (_other, conflictless) {
                    return [_this, _other];
                }]
        ];
        if (pos === null || count === null || count === 0 ||
            new_pos === null) {
            throw 'Invalid Argument';
        }
        this.pos = pos;
        this.count = count;
        this.new_pos = new_pos;
        Object.freeze(this);
    }
    MOVE.prototype.apply = function (document) {
        if (this.pos < this.new_pos) {
            return concat3(document.slice(0, this.pos), document.slice(this.pos + this.count, this.pos), document.slice(this.pos, this.pos + this.count) +
                document.slice(this.new_pos));
        }
        else {
            return concat4(document.slice(0, this.new_pos), document.slice(this.pos, this.pos + this.count), document.slice(this.new_pos, this.pos), document.slice(this.pos + this.count));
        }
    };
    MOVE.prototype.simplify = function () {
        if (this.pos === this.new_pos) {
            return new base_1.NO_OP();
        }
        return this;
    };
    MOVE.prototype.invert = function () {
        if (this.new_pos > this.pos) {
            return new MOVE(this.new_pos, this.count, this.pos);
        }
        else {
            return new MOVE(this.new_pos, this.count, this.pos + this.count);
        }
    };
    MOVE.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof SPLICE) {
            var other = _other;
            if (this.new_pos === other.pos &&
                this.count === other.old_value.length &&
                other.new_value.length === 0) {
                return new DEL(this.pos, other.old_value);
            }
        }
        if (_other instanceof MOVE) {
            var other = _other;
            if (this.new_pos === other.pos && this.count === other.count) {
                return new MOVE(this.pos, other.new_pos, this.count);
            }
        }
        return null;
    };
    return MOVE;
}(base_1.BaseOperation));
exports.MOVE = MOVE;
var APPLY = (function (_super) {
    __extends(APPLY, _super);
    function APPLY(pos, op) {
        var _this = this;
        _super.call(this);
        this._type = ['sequences', 'APPLY'];
        this.rebase_functions = [
            ['APPLY', function (_other, conflictless) {
                    if (_other instanceof APPLY) {
                        var other = _other;
                        if (other.pos != _this.pos) {
                            return [_this, other];
                        }
                        // If they are at the same location, then rebase the sub-operations.
                        var opa = _this.op.rebase(other.op, conflictless);
                        var opb = other.op.rebase(_this.op, conflictless);
                        if (opa && opb) {
                            return [
                                (opa instanceof base_1.NO_OP) ? new base_1.NO_OP() : new exports.APPLY(_this.pos, opa),
                                (opb instanceof base_1.NO_OP) ? new base_1.NO_OP() : new exports.APPLY(other.pos, opb)
                            ];
                        }
                    }
                }],
            ['MAP', function (_other, conflictless) {
                    if (_other instanceof MAP) {
                        var other = _other;
                        var opa = _this.op.rebase(other.op, conflictless);
                        if (!opa) {
                            return null;
                        }
                        var r = (opa instanceof base_1.NO_OP) ? new base_1.NO_OP() : new APPLY(_this.pos, opa);
                        var opb = other.op.rebase(_this.op, conflictless);
                        if (opa && opb && deepEqual(other.op, opb)) {
                            return [
                                r,
                                other
                            ];
                        }
                        else {
                            return [
                                r,
                                new base_1.LIST([_this.invert(), other, r]).simplify()
                            ];
                        }
                    }
                }]
        ];
        if (pos === null || op === null) {
            throw 'Invalid Argument';
        }
        this.pos = pos;
        this.op = op;
        Object.freeze(this);
    }
    APPLY.prototype.apply = function (document) {
        var wut = elem(document, this.pos);
        var huh = this.op.apply(wut);
        return concat3(document.slice(0, this.pos), huh, document.slice(this.pos + 1, document.length));
    };
    APPLY.prototype.simplify = function () {
        var op = this.op.simplify();
        if (op instanceof base_1.NO_OP) {
            return new base_1.NO_OP();
        }
        return this;
    };
    APPLY.prototype.invert = function () {
        return new APPLY(this.pos, this.op.invert());
    };
    APPLY.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof SPLICE) {
            var other = _other;
            if (this.pos >= other.pos &&
                this.pos < other.pos + other.old_value.length) {
                return new SPLICE(other.pos, concat3(other.old_value.slice(0, this.pos - other.pos), unelem(this.invert().apply(elem(other.old_value, this.pos - other.pos)), other.old_value), other.old_value.slice(this.pos - other.pos + 1)), other.new_value).simplify();
            }
        }
        if (_other instanceof APPLY) {
            var other = _other;
            if (this.pos === other.pos) {
                var op2 = this.op.compose(other.op);
                if (op2) {
                    return new APPLY(this.pos, op2);
                }
            }
        }
        return null;
    };
    return APPLY;
}(base_1.BaseOperation));
exports.APPLY = APPLY;
var MAP = (function (_super) {
    __extends(MAP, _super);
    function MAP(op) {
        var _this = this;
        _super.call(this);
        this._type = ['sequences', 'MAP'];
        this.rebase_functions = [
            ['MAP', function (_other, conflictless) {
                    if (_other instanceof MAP) {
                        var other = _other;
                        var opa = _this.op.rebase(other.op, conflictless);
                        var opb = other.op.rebase(_this.op, conflictless);
                        if (opa && opb) {
                            return [
                                (opa instanceof base_1.NO_OP) ? new base_1.NO_OP() : new MAP(opa),
                                (opb instanceof base_1.NO_OP) ? new base_1.NO_OP() : new MAP(opb)
                            ];
                        }
                    }
                }]
        ];
        if (op === null) {
            throw 'Invalid argument';
        }
        this.op = op;
        Object.freeze(this);
    }
    MAP.prototype.apply = function (document) {
        var d;
        if (typeof document === 'string') {
            d = document.split(/.{0}/); // string -> Array<char>
        }
        else {
            d = document.slice(); // clone
        }
        for (var i = 0; i < d.length; i++) {
            d[i] = this.op.apply(d[i]);
        }
        // reform sequence
        if (typeof document === 'string') {
            return d.join('');
        }
        else {
            return d;
        }
    };
    MAP.prototype.simplify = function () {
        var op = this.op.simplify();
        if (op instanceof base_1.NO_OP) {
            return new base_1.NO_OP();
        }
        return this;
    };
    MAP.prototype.invert = function () {
        return new MAP(this.op.invert());
    };
    MAP.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof MAP) {
            var other = _other;
            var op2 = this.op.compose(other.op);
            if (op2) {
                return new MAP(op2);
            }
        }
        return null;
    };
    return MAP;
}(base_1.BaseOperation));
exports.MAP = MAP;
/***
above here are class definitions
below here are helper functions
***/
function elem(seq, pos) {
    if (typeof seq === 'string') {
        return seq.charAt(pos);
    }
    else {
        return seq[pos];
    }
}
function unelem(elem, seq) {
    if (typeof seq === 'string') {
        return elem;
    }
    else {
        return [elem];
    }
}
function concat2(item1, item2) {
    if (item1 instanceof String) {
        return item1 + item2;
    }
    return item1.concat(item2);
}
function concat3(item1, item2, item3) {
    if (item1 instanceof String) {
        return item1 + item2 + item3;
    }
    return item1.concat(item2).concat(item3);
}
function concat4(item1, item2, item3, item4) {
    if (item1 instanceof String) {
        return item1 + item2 + item3 + item4;
    }
    return item1.concat(item2).concat(item3).concat(item4);
}
function map_index(pos, move_op) {
    if (pos >= move_op.pos && pos < move_op.pos + move_op.count) {
        return (pos - move_op.pos) + move_op.new_pos; // within the move
    }
    // before the move
    if (pos < move_op.pos && pos < move_op.new_pos) {
        return pos;
    }
    if (pos < move_op.pos) {
        return pos + move_op.count; // a moved around by from right to left
    }
    if (pos > move_op.pos && pos >= move_op.new_pos) {
        return pos; // after the move
    }
    if (pos > move_op.pos) {
        return pos - move_op.count; // a moved around by from left to right
    }
    throw "unhandled problem";
}
