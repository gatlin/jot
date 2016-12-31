"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var deepEqual = require("deep-equal");
var base_1 = require("./base");
function shallow_clone(document) {
    var d = {};
    for (var k in document) {
        d[k] = document[k];
    }
    return d;
}
var PUT = (function (_super) {
    __extends(PUT, _super);
    function PUT(key, value) {
        var _this = _super.call(this) || this;
        _this._type = ['objects', 'PUT'];
        if (!(_this instanceof PUT)) {
            return new PUT(key, value);
        }
        _this.key = key;
        _this.value = value;
        Object.freeze(_this);
        return _this;
    }
    PUT.prototype.apply = function (document) {
        var d = shallow_clone(document);
        d[this.key] = this.value;
        return d;
    };
    PUT.prototype.simplify = function () {
        return this;
    };
    PUT.prototype.invert = function () {
        return new REM(this.key, this.value);
    };
    PUT.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof REM) {
            var other = _other;
            if (this.key === other.key) {
                return new base_1.NO_OP();
            }
        }
        if (_other instanceof REN) {
            var other = _other;
            if (this.key === other.old_key) {
                return new PUT(other.new_key, this.value);
            }
        }
        if (_other instanceof APPLY) {
            var other = _other;
            if (this.key === other.key) {
                return new PUT(this.key, other.op.apply(this.value));
            }
        }
        return null;
    };
    return PUT;
}(base_1.BaseOperation));
PUT.rebase_functions = [
    ['PUT', function (_other, conflictless) {
            if (_other instanceof PUT) {
                var other = _other;
                if (this.key === other.key) {
                    if (deepEqual(this.value, other.value)) {
                        return [new base_1.NO_OP(), new base_1.NO_OP()];
                    }
                    if (conflictless && base_1.cmp(this.value, other.value) < 0) {
                        return [
                            new base_1.NO_OP(),
                            new APPLY(other.key, new base_1.SET(this.value, other.value))
                        ];
                    }
                    return null;
                }
                else {
                    return [this, other];
                }
            }
            return [this, _other];
        }]
];
exports.PUT = PUT;
var REM = (function (_super) {
    __extends(REM, _super);
    function REM(key, old_value) {
        if (old_value === void 0) { old_value = undefined; }
        var _this = _super.call(this) || this;
        _this._type = ['objects', 'REM'];
        if (!(_this instanceof REM)) {
            return new REM(key, old_value);
        }
        _this.key = key;
        _this.old_value = old_value;
        Object.freeze(_this);
        return _this;
    }
    REM.prototype.apply = function (document) {
        var d = shallow_clone(document);
        delete d[this.key];
        return d;
    };
    REM.prototype.simplify = function () {
        return this;
    };
    REM.prototype.invert = function () {
        return new PUT(this.key, this.old_value);
    };
    REM.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof PUT) {
            var other = _other;
            if (this.key === other.key) {
                return new APPLY(this.key, new base_1.SET(other.value));
            }
        }
        return null;
    };
    return REM;
}(base_1.BaseOperation));
REM.rebase_functions = [
    ['REM', function (_other, conflictless) {
            if (_other instanceof REM) {
                var other = _other;
                if (this.key === other.key) {
                    return [new base_1.NO_OP(), new base_1.NO_OP()];
                }
            }
            return [this, _other];
        }],
    ['REN', function (_other, conflictless) {
            if (_other instanceof REN) {
                var other = _other;
                if (this.key === other.old_key) {
                    return [
                        new REM(other.new_key, this.old_value),
                        new base_1.NO_OP()
                    ];
                }
            }
            return [this, _other];
        }],
    ['APPLY', function (_other, conflictless) {
            if (_other instanceof APPLY) {
                var other = _other;
                if (this.key === other.key) {
                    return [
                        new REM(this.key, other.op.apply(this.old_value)),
                        new base_1.NO_OP()
                    ];
                }
            }
            return [this, _other];
        }]
];
exports.REM = REM;
var REN = (function (_super) {
    __extends(REN, _super);
    function REN(old_key, new_key) {
        var _this = _super.call(this) || this;
        _this._type = ['objects', 'REN'];
        if (!(_this instanceof REN)) {
            return new REN(old_key, new_key);
        }
        if (old_key === null || new_key === null) {
            throw 'Invalid arguments';
        }
        _this.old_key = old_key;
        _this.new_key = new_key;
        Object.freeze(_this);
        return _this;
    }
    REN.prototype.apply = function (document) {
        var d = shallow_clone(document);
        var v = d[this.old_key];
        delete d[this.old_key];
        d[this.new_key] = v;
        return d;
    };
    REN.prototype.simplify = function () {
        return this;
    };
    REN.prototype.invert = function () {
        return new REN(this.new_key, this.old_key);
    };
    REN.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof REM) {
            var other = _other;
            if (this.new_key === other.key) {
                return new REM(this.old_key);
            }
        }
        return null;
    };
    return REN;
}(base_1.BaseOperation));
REN.rebase_functions = [
    ['REN', function (_other, conflictless) {
            if (_other instanceof REN) {
                var other = _other;
                if (this.old_key === other.old_key) {
                    if (this.new_key === other.new_key) {
                        return [new base_1.NO_OP(), new base_1.NO_OP()];
                    }
                    if (conflictless && base_1.cmp(this.new_key, other.new_key) < 0) {
                        return [
                            new base_1.NO_OP(),
                            new REN(this.new_key, other.new_key)
                        ];
                    }
                    return null;
                }
                if (this.new_key === other.new_key) {
                    if (conflictless && base_1.cmp(this.old_key, other.old_key) < 0) {
                        return [
                            new base_1.NO_OP(),
                            other
                        ];
                    }
                    return null;
                }
            }
            return [this, _other];
        }],
    ['APPLY', function (_other, conflictless) {
            if (_other instanceof APPLY) {
                var other = _other;
                if (this.old_key === other.key) {
                    return [
                        this,
                        new APPLY(this.new_key, other.op)
                    ];
                }
            }
            return [this, _other];
        }]
];
exports.REN = REN;
var APPLY = (function (_super) {
    __extends(APPLY, _super);
    function APPLY(key, op) {
        var _this = _super.call(this) || this;
        _this._type = ['objects', 'APPLY'];
        if (!(_this instanceof APPLY)) {
            return new APPLY(key, op);
        }
        if (key === null || op === null) {
            throw 'Invalid arguments';
        }
        _this.key = key;
        _this.op = op;
        Object.freeze(_this);
        return _this;
    }
    APPLY.prototype.apply = function (document) {
        //        const d = shallow_clone(document);
        var d = {};
        for (var k in document) {
            d[k] = document[k];
        }
        d[this.key] = this.op.apply(d[this.key]);
        return d;
    };
    APPLY.prototype.simplify = function () {
        var op2 = this.op.simplify();
        if (op2 instanceof base_1.NO_OP) {
            return new base_1.NO_OP();
        }
        return this;
    };
    APPLY.prototype.invert = function () {
        return new APPLY(this.key, this.op.invert());
    };
    APPLY.prototype.compose = function (_other) {
        if (_other instanceof base_1.NO_OP) {
            return this;
        }
        if (_other instanceof base_1.SET) {
            var other = _other;
            return new base_1.SET(this.invert().apply(other.old_value), other.new_value).simplify();
        }
        if (_other instanceof REM) {
            var other = _other;
            if (this.key === other.key) {
                return other.simplify();
            }
        }
        if (_other instanceof APPLY) {
            var other = _other;
            if (this.key === other.key) {
                var op2 = this.op.compose(other.op);
                if (op2) {
                    return new APPLY(this.key, op2);
                }
            }
        }
        return null;
    };
    return APPLY;
}(base_1.BaseOperation));
APPLY.rebase_functions = [
    ['APPLY', function (_other, conflictless) {
            if (_other instanceof APPLY) {
                var other = _other;
                if (this.key !== other.key) {
                    return [this, other];
                }
                var opa = this.op.rebase(other.op, conflictless);
                var opb = other.op.rebase(this.op, conflictless);
                if (opa && opb) {
                    return [
                        (opa instanceof base_1.NO_OP)
                            ? new base_1.NO_OP()
                            : new APPLY(this.key, opa),
                        (opb instanceof base_1.NO_OP)
                            ? new base_1.NO_OP()
                            : new APPLY(other.key, opb)
                    ];
                }
            }
            return null;
        }]
];
exports.APPLY = APPLY;
