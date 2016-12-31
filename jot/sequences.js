"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var deepEqual = require("deep-equal");
var base_1 = require("./base");
var SPLICE = (function (_super) {
    __extends(SPLICE, _super);
    function SPLICE(pos, old_value, new_value) {
        var _this = _super.call(this) || this;
        _this._type = ['sequences', 'SPLICE'];
        if (pos === null || old_value === null || new_value === null) {
            throw 'Invalid argument';
        }
        _this.pos = pos;
        _this.old_value = old_value;
        _this.new_value = new_value;
        Object.freeze(_this);
        return _this;
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
SPLICE.rebase_functions = [
    ['SPLICE', function (_other, conflictless) {
            var other = _other;
            if (deepEqual(this, other)) {
                return [new base_1.NO_OP(), new base_1.NO_OP()];
            }
            // Two insertions at the same location.
            if (this.pos == other.pos && this.old_value.length == 0 &&
                other.old_value.length == 0) {
                if (conflictless && base_1.cmp(this.new_value, other.new_value)
                    < 0) {
                    return [this, new exports.SPLICE(other.pos +
                            this.new_value.length, other.old_value, other.new_value)];
                }
                return null;
            }
            else if (this.pos == other.pos && this.old_value.length ==
                other.old_value.length) {
                if (conflictless && base_1.cmp(this.new_value, other.new_value) <
                    0) {
                    return [
                        new base_1.NO_OP(),
                        new SPLICE(other.pos, this.new_value, other.new_value)
                    ];
                }
                return null;
            }
            else if (this.pos + this.old_value.length <= other.pos)
                return [
                    this,
                    new exports.SPLICE(other.pos + (this.new_value.length -
                        this.old_value.length), other.old_value, other.new_value)
                ];
            else if (conflictless
                && ((this.pos < other.pos) || (this.pos == other.pos &&
                    this.old_value.length >
                        other.old_value.length))
                && ((this.pos + this.old_value.length > other.pos +
                    other.old_value.length)
                    || ((this.pos + this.old_value.length == other.pos +
                        other.old_value.length) && this.pos < other.pos))) {
                return [
                    new SPLICE(this.pos, concat3(this.old_value.slice(0, other.pos - this.pos), other.new_value, this.old_value.slice(other.pos +
                        other.old_value.length -
                        this.pos)), this.new_value),
                    // other gets clobbered
                    new base_1.NO_OP(),
                ];
            }
            else if (conflictless && this.pos < other.pos) {
                return [
                    new SPLICE(this.pos, this.old_value.slice(0, other.pos - this.pos), this.new_value),
                    new SPLICE(this.pos + this.new_value.length, other.old_value.slice(this.pos +
                        this.old_value.length - other.pos), other.new_value)
                ];
            }
            return null;
        }],
    ['MOVE', function (_other, conflictless) {
            if (_other instanceof MOVE) {
                var other = _other;
                if (this.pos + this.old_value.length < other.pos) {
                    return [
                        new SPLICE(map_index(this.pos, other), this.old_value, this.new_value),
                        new MOVE(other.pos + this.new_value.length -
                            this.old_value.length, other.count, other.new_pos)
                    ];
                }
                if (this.pos >= other.pos + other.count) {
                    return [
                        new SPLICE(map_index(this.pos, other), this.old_value, this.new_value),
                        other
                    ];
                }
            }
        }],
    ['APPLY', function (_other, conflictless) {
            if (_other instanceof APPLY) {
                var other = _other;
                // other is after the spliced range
                if (other.pos >= this.pos + this.old_value.length) {
                    return [this, new exports.APPLY(other.pos +
                            this.new_value.length - this.old_value, other.op)];
                }
                // other is before the spliced range
                if (other.pos < this.pos) {
                    return [this, other];
                }
                var old_value = concat3(this.old_value.slice(0, other.pos - this.pos), unelem(other.op.apply(elem(this.old_value, other.pos -
                    this.pos)), this.old_value), this.old_value.slice(other.pos - this.pos + 1));
                if (this.new_value.length == this.old_value.length) {
                    try {
                        var new_value = concat3(this.new_value.slice(0, other.pos - this.pos), unelem(other.op.apply(elem(this.new_value, other.pos
                            - this.pos)), this.old_value), this.new_value.slice(other.pos - this.pos + 1));
                        return [
                            new exports.SPLICE(this.pos, old_value, new_value),
                            other
                        ];
                    }
                    catch (e) {
                    }
                }
                // Otherwise, in conflictless mode, the SPLICE takes precedence.
                if (conflictless) {
                    return [
                        new SPLICE(this.pos, old_value, this.new_value),
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
                        new SPLICE(this.pos, other.apply(this.old_value), other.apply(this.new_value)),
                        other
                    ];
                }
                catch (e) {
                    if (conflictless)
                        return [
                            new SPLICE(this.pos, other.apply(this.old_value), this.new_value),
                            new base_1.NO_OP()
                        ];
                }
                // Can't resolve conflict.
                return null;
            }
            return null;
        }]
];
exports.SPLICE = SPLICE;
var INS = (function (_super) {
    __extends(INS, _super);
    function INS(pos, value) {
        return _super.call(this, pos, value.slice(0, 0), value) || this;
    }
    return INS;
}(SPLICE));
exports.INS = INS;
var DEL = (function (_super) {
    __extends(DEL, _super);
    function DEL(pos, old_value) {
        return _super.call(this, pos, old_value, old_value.slice(0, 0)) || this;
    }
    return DEL;
}(SPLICE));
exports.DEL = DEL;
var MOVE = (function (_super) {
    __extends(MOVE, _super);
    function MOVE(pos, count, new_pos) {
        var _this = _super.call(this) || this;
        _this._type = ['sequences', 'MOVE'];
        if (pos === null || count === null || count === 0 ||
            new_pos === null) {
            throw 'Invalid Argument';
        }
        _this.pos = pos;
        _this.count = count;
        _this.new_pos = new_pos;
        Object.freeze(_this);
        return _this;
    }
    MOVE.prototype.apply = function (document) {
        /* Applies the operation to a document. Returns a new sequence that is
           the same type as document but with the subrange moved. */
        if (this.pos < this.new_pos)
            return concat3(document.slice(0, this.pos), document.slice(this.pos
                + this.count, this.new_pos), document.slice(this.pos, this.pos +
                this.count)
                + document.slice(this.new_pos));
        else
            return concat4(document.slice(0, this.new_pos), document.slice(this.pos, this.pos + this.count), document.slice(this.new_pos, this.pos), document.slice(this.pos +
                this.count));
    };
    MOVE.prototype.simplify = function () {
        if (this.pos === this.new_pos) {
            return new base_1.NO_OP();
        }
        return this;
    };
    MOVE.prototype.invert = function () {
        if (this.new_pos > this.pos)
            return new MOVE(this.new_pos - this.count, this.count, this.pos);
        else
            return new MOVE(this.new_pos, this.count, this.pos + this.count);
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
MOVE.rebase_functions = [
    ['MOVE', function (_other, conflictless) {
            if (_other instanceof MOVE) {
                var other = _other;
                if (this.pos + this.count >= other.pos && this.pos < other.pos +
                    other.count)
                    return null;
                return [
                    new exports.MOVE(map_index(this.pos, other), this.count, map_index(this.new_pos, other)),
                    null
                ];
            }
            return null;
        }],
    ['APPLY', function (_other, conflictless) {
            if (_other instanceof APPLY) {
                var other = _other;
                return [
                    this,
                    new APPLY(map_index(other.pos, this), other.op)
                ];
            }
            return null;
        }],
    ['MAP', function (_other, conflictless) {
            return [this, _other];
        }]
];
exports.MOVE = MOVE;
var APPLY = (function (_super) {
    __extends(APPLY, _super);
    function APPLY(pos, op) {
        var _this = _super.call(this) || this;
        _this._type = ['sequences', 'APPLY'];
        if (pos === null || op === null) {
            throw 'Invalid Argument';
        }
        _this.pos = pos;
        _this.op = op;
        Object.freeze(_this);
        return _this;
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
APPLY.rebase_functions = [
    ['APPLY', function (_other, conflictless) {
            var other = _other;
            if (other.pos != this.pos) {
                return [this, other];
            }
            // If they are at the same location, then rebase the sub-operations.
            var opa = this.op.rebase(other.op, conflictless);
            var opb = other.op.rebase(this.op, conflictless);
            if (opa && opb) {
                return [
                    (opa instanceof base_1.NO_OP) ? new base_1.NO_OP() : new exports.APPLY(this.pos, opa),
                    (opb instanceof base_1.NO_OP) ? new base_1.NO_OP() : new exports.APPLY(other.pos, opb)
                ];
            }
            return null;
        }],
    ['MAP', function (_other, conflictless) {
            if (_other instanceof MAP) {
                var other = _other;
                var opa = this.op.rebase(other.op, conflictless);
                if (!opa) {
                    return null;
                }
                var r = (opa instanceof base_1.NO_OP) ? new base_1.NO_OP() : new APPLY(this.pos, opa);
                var opb = other.op.rebase(this.op, conflictless);
                if (opa && opb && deepEqual(other.op, opb)) {
                    return [
                        r,
                        other
                    ];
                }
                else {
                    return [
                        r,
                        new base_1.LIST([this.invert(), other, r]).simplify()
                    ];
                }
            }
        }]
];
exports.APPLY = APPLY;
var MAP = (function (_super) {
    __extends(MAP, _super);
    function MAP(op) {
        var _this = _super.call(this) || this;
        _this._type = ['sequences', 'MAP'];
        if (op === null) {
            throw 'Invalid argument';
        }
        _this.op = op;
        Object.freeze(_this);
        return _this;
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
MAP.rebase_functions = [
    ['MAP', function (_other, conflictless) {
            var other = _other;
            var opa = this.op.rebase(other.op, conflictless);
            var opb = other.op.rebase(this.op, conflictless);
            if (opa && opb) {
                return [
                    (opa instanceof base_1.NO_OP) ? new base_1.NO_OP() : new MAP(opa),
                    (opb instanceof base_1.NO_OP) ? new base_1.NO_OP() : new MAP(opb)
                ];
            }
            return null;
        }]
];
exports.MAP = MAP;
/***
above here are class definitions
below here are helper functions
***/
function from_diff(old_value, new_value, mode) {
    // Do a diff, which results in an array of operations of the form
    //  (op_type, op_data)
    // where
    //  op_type ==  0 => text same on both sides
    //  op_type == -1 => text deleted (op_data is deleted text)
    //  op_type == +1 => text inserted (op_data is inserted text)
    // If mode is undefined or 'chars', the diff is performed over
    // characters. Mode can also be 'words' or 'lines'.
    var diff_match_patch = require('googlediff');
    var jot = require('./index.js');
    var dmp = new diff_match_patch();
    /////////////////////////////////////////////////////////////
    // adapted from diff_match_patch.prototype.diff_linesToChars_
    function diff_tokensToChars_(text1, text2, split_regex) {
        var lineArray = [];
        var lineHash = {};
        lineArray[0] = '';
        function munge(text) {
            var chars = '';
            var lineStart = 0;
            var lineEnd = -1;
            var lineArrayLength = lineArray.length;
            while (lineEnd < text.length - 1) {
                split_regex.lastIndex = lineStart;
                var m = split_regex.exec(text);
                if (m)
                    lineEnd = m.index;
                else
                    lineEnd = text.length - 1;
                var line = text.substring(lineStart, lineEnd + 1);
                lineStart = lineEnd + 1;
                if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
                    (lineHash[line] !== undefined)) {
                    chars += String.fromCharCode(lineHash[line]);
                }
                else {
                    chars += String.fromCharCode(lineArrayLength);
                    lineHash[line] = lineArrayLength;
                    lineArray[lineArrayLength++] = line;
                }
            }
            return chars;
        }
        var chars1 = munge(text1);
        var chars2 = munge(text2);
        return { chars1: chars1, chars2: chars2, lineArray: lineArray };
    }
    /////////////////////////////////////////////////////////////
    // handle words or lines mode
    var token_state = null;
    if (mode == "words")
        token_state = diff_tokensToChars_(old_value, new_value, /[\W]/g);
    if (mode == "lines")
        token_state = diff_tokensToChars_(old_value, new_value, /\n/g);
    var t1 = old_value;
    var t2 = new_value;
    if (token_state) {
        t1 = token_state.chars1;
        t2 = token_state.chars2;
    }
    // perform the diff
    var d = dmp.diff_main(t1, t2);
    // handle words or lines mode
    if (token_state)
        dmp.diff_charsToLines_(d, token_state.lineArray);
    dmp.diff_cleanupSemantic(d);
    // turn the output into an array of DEL and INS operations
    var ret = [];
    var pos = 0;
    for (var i = 0; i < d.length; i++) {
        if (d[i][0] == 0) {
            pos += d[i][1].length;
        }
        else if (d[i][0] == -1) {
            ret.push(new exports.DEL(pos, d[i][1]));
        }
        else if (d[i][0] == 1) {
            ret.push(new exports.INS(pos, d[i][1]));
            pos += d[i][1].length;
        }
    }
    return new base_1.LIST(ret);
}
exports.from_diff = from_diff;
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
