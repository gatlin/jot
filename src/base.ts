/* Base functions */

import * as util from 'util';
import * as deepEqual from 'deep-equal';

type RebaseFunction = any; // kludge

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
export function cmp(a, b) {
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
        let x = cmp(a.length, b.length);
        if (x !== 0) {
            return x;
        }

        for (let i = 0; i < a.length; i++) {
            x = cmp(a[i], b[i]);
            if (x !== 0) {
                return x;
            }
        }

        return 0;
    }

    throw 'Type ' + type_name(a) + ' not comparable.';
}

export abstract class BaseOperation {

    public type: Array<any>; // kludge
    public static rebase_functions: Array<RebaseFunction> = [];
    public abstract _type: Array<string>;

    public inspect(depth) {
        let repr = [];
        let keys = Object.keys(this);
        for (let i = 0; i < keys.length; i++) {
            let v;
            if (this[keys[i]] instanceof BaseOperation) {
                v = this[keys[i]].inspect(depth - 1);
            }
            else if (typeof this[keys[i]] !== 'undefined' &&
                keys[i] !== '_type') {
                v = util.format("%j", this[keys[i]]);
            }
            else {
                continue;
            }
            repr.push(keys[i] + ':' + v);
        }

        return util.format('<%s.%s {%s}>',
            this._type[0],
            this._type[1],
            repr.join(', '));
    }

    public toJsonableObject() {
        const repr = {};
        repr['_type'] = { 'module': this._type[0], 'class': this._type[1] };
        const keys = Object.keys(this);
        for (let i = 0; i < keys.length; i++) {
            let v;
            if (this[keys[i]] instanceof BaseOperation) {
                v = this[keys[i]].toJsonableObject();
            }
            else if (keys[i] === 'ops' && Array.isArray(this[keys[i]])) {
                v = this[keys[i]].map(ki => ki.toJsonableObject());
            }
            else if (typeof this[keys[i]] !== 'undefined' &&
                keys[i] !== '_type') {
                v = this[keys[i]];
            }
            else {
                continue;
            }

            repr[keys[i]] = v;
        }

        return repr;
    }

    public serialize() {
        return JSON.stringify(this.toJsonableObject());
    }

    public rebase(_other: BaseOperation, conflictless: boolean = false):
        BaseOperation {
        if (this._type[1] === 'NO_OP') {
            return this;
        }

        if (_other._type[1] === 'NO_OP') {
            return this;
        }

        for (let i = 0; i < ((this.constructor['rebase_functions'] !== null)
            ? this.constructor['rebase_functions'].length
            : 0); i++) {
            if (_other._type[1] === this.constructor['rebase_functions'][i][0]) {
                let r = this.constructor['rebase_functions'][i][1].call(
                    this,
                    _other,
                    conflictless);
                if (r !== null && r[0] !== null) {
                    return r[0];
                }
            }
        }

        for (let i = 0; i < ((_other.constructor['rebase_functions'] !== null)
            ? _other.constructor['rebase_functions'].length
            : 0); i++) {
            if (this._type[1] === _other.constructor['rebase_functions'][i][0]) {
                let r = _other.constructor['rebase_functions'][i][1].call(
                    _other,
                    this,
                    conflictless);

                if (r !== null && r[1] !== null) {
                    return r[1];
                }
            }
        }

        return null;
    }

    abstract apply(document: any): any;
    abstract simplify(): BaseOperation;
    abstract invert(): BaseOperation;
    abstract compose(other: BaseOperation): BaseOperation;

}

export class NO_OP extends BaseOperation {

    public _type = ['values', 'NO_OP'];

    constructor() {
        super();
        Object.freeze(this);
    }

    public apply(document) {
        return document;
    }

    public simplify() {
        return this;
    }

    public invert() {
        return this;
    }

    public compose(other) {
        return other;
    }

}

export class SET extends BaseOperation {

    public _type = ['values', 'SET'];
    public static rebase_functions = [
        ['SET', function (_other, conflictless) {
            let other = _other as SET;
            if (deepEqual(this.new_value, other.new_value)) {
                return [new NO_OP(), new NO_OP()];
            }

            if (conflictless && cmp(this.new_value, other.new_value) < 0) {
                return [new NO_OP(), new SET(this.new_value, other.new_value)];
            }

            return null;
        }],

        ['MATH', function (_other, conflictless) {
            let other = _other as MATH;

            try {
                return [new SET(other.apply(this.old_value),
                    other.apply(this.new_value)),
                    other
                ];
            } catch (e) {
                if (conflictless) {
                    return [
                        new SET(other.apply(this.old_value), this.new_value),
                        new NO_OP()
                    ];
                }
            }

            return null;
        }]
    ];

    public old_value: any;
    public new_value: any;

    constructor(old_value, new_value = undefined) {
        super();
        this.old_value = old_value;
        this.new_value = new_value;
        Object.freeze(this);
    }

    public apply(document) {
        return this.new_value;
    }

    public simplify(): BaseOperation {
        if (deepEqual(this.old_value, this.new_value)) {
            return new NO_OP();
        }
        return this;
    }

    public invert(): BaseOperation {
        return new SET(this.new_value, this.old_value);
    }

    public compose(other: BaseOperation): BaseOperation {
        return new SET(this.old_value,
            other.apply(this.new_value))
            .simplify();
    }
}

export class MATH extends BaseOperation {
    public _type = ['values', 'MATH'];

    public static rebase_functions = [
        ['MATH', function (_other, conflictless) {
            let other = _other as MATH;
            if (this.operator === other.operator) {
                if (this.operator !== 'rot' ||
                    this.operand[1] !== other.operand[1]) {
                    return [this, _other];
                }
            }

            if (conflictless) {
                if (cmp([this.operator, this.operand],
                    [other.operator, other.operand]) < 0) {
                    return [
                        this,
                        new LIST([this.invert(), _other, this])
                    ];
                }
            }
            return null;
        }]
    ];

    public operator: any;
    public operand: any;

    constructor(operator, operand) {
        super();
        this.operator = operator;
        this.operand = operand;
        Object.freeze(this);
    }

    public apply(document: any) {
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
            return <number>document * this.operand;
        }

        if (this.operator === 'xor') {
            let ret: any = <number>document ^ this.operand;
            if (typeof document === 'boolean') {
                ret = !!ret;
            }
            return ret;
        }
    }

    public simplify(): BaseOperation {
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
    }

    public invert() {
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
    }

    public compose(other: BaseOperation): BaseOperation {
        if (other instanceof NO_OP) {
            return this;
        }

        if (other instanceof SET) {
            let _other = other as SET;
            return new SET(
                this.invert()
                    .apply(_other.old_value),
                _other.new_value)
                .simplify();
        }

        if (other instanceof MATH) {
            let _other = other as MATH;
            if (this.operator === _other.operator) {
                if (this.operator === 'add') {
                    return new MATH('add', this.operand + _other.operand);
                }

                if (this.operator === 'rot') {
                    return new MATH('rot',
                        [this.operand[0] + _other.operand[0],
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
    }
}

function rebase_array(base, ops) {
    if (ops.length === 0 || base.length === 0) {
        return ops;
    }

    if (base instanceof Array) {
        for (let i = 0; i < base.length; i++) {
            ops = rebase_array(base[i], ops);
            if (!ops) {
                return null;
            }
        }
        return ops;
    }

    else {
        if (ops.length === 1) {
            let op = ops[0].rebase(base);
            if (!op) {
                return null; // conflict
            }
            return [op];
        }

        let op1 = ops[0];
        let op2 = ops.splice(1);

        let r1 = op1.rebase(base);
        if (!r1) {
            return null; // rebase failed
        }

        let r2 = base.rebase(op1);
        if (!r2) {
            return null; // rebase failed
        }

        let r3 = rebase_array(r2, op2);
        if (!r3) {
            return null; // rebase failed
        }

        return [r1].concat(r3);
    }
}

export class LIST extends BaseOperation {
    public _type = ['meta', 'LIST'];
    public ops: Array<BaseOperation>;

    constructor(ops) {
        super();
        if (ops === null) {
            throw 'Invalid argument';
        }
        if (!(ops instanceof Array)) {
            throw 'Invalid argument';
        }

        this.ops = ops;
        Object.freeze(this);
    }

    public apply(document: any): any {
        for (let i = 0; i < this.ops.length; i++) {
            document = this.ops[i].apply(document);
        }

        return document;
    }

    public simplify(): BaseOperation {
        const new_ops = [];
        for (let i = 0; i < this.ops.length; i++) {
            let op: BaseOperation = this.ops[i];

            if (op instanceof NO_OP) {
                continue;
            }

            if (new_ops.length === 0) {
                new_ops.push(op);
            } else {
                for (let j = new_ops.length - 1; j >= 0; j--) {
                    let c = new_ops[j].compose(op);
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
                            let r1 = op.rebase(new_ops[j].invert());
                            let r2 = new_ops[j].rebase(op);
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
    }

    public invert(): BaseOperation {
        let new_ops = [];
        for (let i = this.ops.length - 1; i >= 0; i--) {
            new_ops.push(this.ops[i].invert());
        }
        return new LIST(new_ops);
    }

    public compose(_other: BaseOperation): BaseOperation {
        if (this.ops.length === 0) {
            return new LIST([_other]);
        }

        if (_other instanceof NO_OP) {
            return this;
        }

        if (_other instanceof SET) {
            let other = _other as SET;
            return other.simplify();
        }

        if (_other instanceof LIST) {
            let other = _other as LIST;
            if (other.ops.length === 0) {
                return this;
            }
            return new LIST(this.ops.concat(other.ops));
        }

        let new_ops = this.ops.slice();
        new_ops.push(_other);
        return new LIST(new_ops);
    }

    public rebase(_other: BaseOperation): BaseOperation {
        if (_other instanceof NO_OP) {
            return this;
        }

        let base;
        if (_other instanceof LIST) {
            let other = _other as LIST;
            base = other.ops;
        } else {
            base = _other;
        }

        let ops = rebase_array(base, this.ops);
        if (ops === null) {
            return null;
        }

        if (ops.length === 0) {
            return new NO_OP();
        }

        return new LIST(ops);
    }
}
