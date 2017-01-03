import * as deepEqual from 'deep-equal';
import { BaseOperation, NO_OP, SET, MATH, cmp } from './base';

function shallow_clone(document) {
    const d = {};
    for (let k in document) {
        d[k] = document[k];
    }
    return d;
}

export class PUT extends BaseOperation {
    protected _type = ['objects', 'PUT'];
    public static rebase_functions = [
        ['PUT', function (_other, conflictless) {
            if (_other instanceof PUT) {
                let other = _other as PUT;
                if (this.key === other.key) {
                    if (deepEqual(this.value, other.value)) {
                        return [new NO_OP(), new NO_OP()];
                    }

                    if (conflictless && cmp(this.value, other.value) < 0) {
                        return [
                            new NO_OP(),
                            new APPLY(other.key, new
                                SET(this.value, other.value))
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

    public key: any;
    public value: any;

    constructor(key, value) {
        super();
        if (!(this instanceof PUT)) {
            return new PUT(key, value);
        }
        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    public apply(document: any): any {
        const d = shallow_clone(document);
        d[this.key] = this.value;
        return d;
    }

    public simplify(): BaseOperation {
        return this;
    }

    public invert(): BaseOperation {
        return new REM(this.key, this.value);
    }

    public compose(_other: BaseOperation): BaseOperation {
        if (_other instanceof NO_OP) {
            return this;
        }

        if (_other instanceof SET) {
            let other = _other as SET;
            return new SET(this.invert().apply(
                other.old_value),
                other.new_value).simplify();
        }

        if (_other instanceof REM) {
            let other = _other as REM;
            if (this.key === other.key) {
                return new NO_OP();
            }
        }

        if (_other instanceof REN) {
            let other = _other as REN;
            if (this.key === other.old_key) {
                return new PUT(other.new_key, this.value);
            }
        }

        if (_other instanceof APPLY) {
            let other = _other as APPLY;
            if (this.key === other.key) {
                return new PUT(this.key, other.op.apply(this.value));
            }
        }

        return null;
    }
}

export class REM extends BaseOperation {
    public key: any;
    public old_value: any;

    protected _type = ['objects', 'REM'];
    public static rebase_functions = [
        ['REM', function (_other, conflictless) {
            if (_other instanceof REM) {
                let other = _other as REM;
                if (this.key === other.key) {
                    return [new NO_OP(), new NO_OP()];
                }
            }
            return [this, _other];
        }],

        ['REN', function (_other, conflictless) {
            if (_other instanceof REN) {
                let other = _other as REN;
                if (this.key === other.old_key) {
                    return [
                        new REM(other.new_key, this.old_value),
                        new NO_OP()
                    ];
                }
            }
            return [this, _other];
        }],

        ['APPLY', function (_other, conflictless) {
            if (_other instanceof APPLY) {
                let other = _other as APPLY;
                if (this.key === other.key) {
                    return [
                        new REM(this.key,
                            other.op.apply(this.old_value)),
                        new NO_OP()
                    ];
                }
            }
            return [this, _other];
        }]
    ];

    constructor(key, old_value = undefined) {
        super();
        if (!(this instanceof REM)) {
            return new REM(key, old_value);
        }
        this.key = key;
        this.old_value = old_value;
        Object.freeze(this);
    }

    public apply(document: any): any {
        const d = shallow_clone(document);
        delete d[this.key];
        return d;
    }

    public simplify(): BaseOperation {
        return this;
    }

    public invert(): BaseOperation {
        return new PUT(this.key, this.old_value);
    }

    public compose(_other: BaseOperation): BaseOperation {
        if (_other instanceof NO_OP) {
            return this;
        }

        if (_other instanceof SET) {
            let other = _other as SET;
            return new SET(this.invert().apply(
                other.old_value), other.new_value).simplify();
        }

        if (_other instanceof PUT) {
            let other = _other as PUT;
            if (this.key === other.key) {
                return new APPLY(this.key, new SET(other.value));
            }
        }

        return null;
    }
}

export class REN extends BaseOperation {
    public old_key: any;
    public new_key: any;

    protected _type = ['objects', 'REN'];
    public static rebase_functions = [
        ['REN', function (_other, conflictless) {
            if (_other instanceof REN) {
                let other = _other as REN;
                if (this.old_key === other.old_key) {
                    if (this.new_key === other.new_key) {
                        return [new NO_OP(), new NO_OP()];
                    }

                    if (conflictless && cmp(this.new_key, other.new_key) < 0) {
                        return [
                            new NO_OP(),
                            new REN(this.new_key, other.new_key)
                        ];
                    }

                    return null;
                }

                if (this.new_key === other.new_key) {
                    if (conflictless && cmp(this.old_key, other.old_key) < 0) {
                        return [
                            new NO_OP(),
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
                let other = _other as APPLY;
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

    constructor(old_key, new_key) {
        super();
        if (!(this instanceof REN)) {
            return new REN(old_key, new_key);
        }
        if (old_key === null || new_key === null) {
            throw 'Invalid arguments';
        }
        this.old_key = old_key;
        this.new_key = new_key;
        Object.freeze(this);
    }

    public apply(document: any): any {
        const d = shallow_clone(document);
        const v = d[this.old_key];
        delete d[this.old_key];
        d[this.new_key] = v;
        return d;
    }

    public simplify(): BaseOperation {
        return this;
    }

    public invert(): BaseOperation {
        return new REN(this.new_key, this.old_key);
    }

    public compose(_other: BaseOperation): BaseOperation {
        if (_other instanceof NO_OP) {
            return this;
        }

        if (_other instanceof SET) {
            let other = _other as SET;
            return new SET(this.invert().apply(
                other.old_value), other.new_value).simplify();
        }

        if (_other instanceof REM) {
            let other = _other as REM;
            if (this.new_key === other.key) {
                return new REM(this.old_key);
            }
        }

        return null;
    }
}

export class APPLY extends BaseOperation {
    public key: any;
    public op: BaseOperation;

    protected _type = ['objects', 'APPLY'];
    public static rebase_functions = [
        ['APPLY', function (_other, conflictless) {
            if (_other instanceof APPLY) {
                let other = _other as APPLY;
                if (this.key !== other.key) {
                    return [this, other];
                }

                const opa = this.op.rebase(other.op, conflictless);
                const opb = other.op.rebase(this.op, conflictless);

                if (opa && opb) {
                    return [
                        (opa instanceof NO_OP)
                            ? new NO_OP()
                            : new APPLY(this.key, opa),
                        (opb instanceof NO_OP)
                            ? new NO_OP()
                            : new APPLY(other.key, opb)
                    ];
                }
            }

            return null;
        }]
    ];

    constructor(key, op) {
        super();
        if (!(this instanceof APPLY)) {
            return new APPLY(key, op);
        }
        if (key === null || op === null) {
            throw 'Invalid arguments';
        }

        this.key = key;
        this.op = op;

        Object.freeze(this);
    }

    public apply(document: any): any {

        const d = {};
        for (let k in document) {
            d[k] = document[k];
        }

        d[this.key] = this.op.apply(d[this.key]);
        return d;
    }

    public simplify(): BaseOperation {
        const op2 = this.op.simplify();
        if (op2 instanceof NO_OP) {
            return new NO_OP();
        }
        return this;
    }

    public invert(): BaseOperation {
        return new APPLY(this.key, this.op.invert());
    }

    public compose(_other: BaseOperation): BaseOperation {
        if (_other instanceof NO_OP) {
            return this;
        }

        if (_other instanceof SET) {
            let other = _other as SET;
            return new SET(this.invert().apply(other.old_value),
                other.new_value).simplify();
        }

        if (_other instanceof REM) {
            let other = _other as REM;
            if (this.key === other.key) {
                return other.simplify();
            }
        }

        if (_other instanceof APPLY) {
            let other = _other as APPLY;
            if (this.key === other.key) {
                const op2 = this.op.compose(other.op);
                if (op2) {
                    return new APPLY(this.key, op2);
                }
            }
        }

        return null;
    }
}
