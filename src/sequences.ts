import * as deepEqual from 'deep-equal';
import { BaseOperation, LIST, NO_OP, SET, MATH, cmp } from './base';

export class SPLICE extends BaseOperation {
    public op_name = 'SPLICE';
    public rebase_functions = [
        ['SPLICE', (_other, conflictless) => {
            if (_other instanceof SPLICE) {
                let other = _other as SPLICE;

                if (deepEqual(this, other)) {
                    return [new NO_OP(), new NO_OP()];
                }

                // Two insertions at the same location.
                if (this.pos == other.pos && this.old_value.length == 0 &&
                    other.old_value.length == 0) {

                    if (conflictless && cmp(this.new_value, other.new_value)
                        < 0) {
                        return [this, new exports.SPLICE(other.pos +
                            this.new_value.length,
                            other.old_value,
                            other.new_value)];
                    }

                    return null;

                } else if (this.pos == other.pos && this.old_value.length ==
                    other.old_value.length) {

                    if (conflictless && cmp(this.new_value, other.new_value) <
                        0) {
                        return [
                            new NO_OP(),
                            new SPLICE(other.pos, this.new_value,
                                other.new_value)
                        ];
                    }

                    return null;

                } else if (this.pos + this.old_value.length <= other.pos)
                    return [
                        this,
                        new exports.SPLICE(other.pos + (this.new_value.length -
                            this.old_value.length),
                            other.old_value, other.new_value)];

                else if (conflictless
                    && ((this.pos < other.pos) || (this.pos == other.pos &&
                        this.old_value.length >
                        other.old_value.length))
                    && ((this.pos + this.old_value.length > other.pos +
                        other.old_value.length)
                        || ((this.pos + this.old_value.length == other.pos +
                            other.old_value.length) && this.pos < other.pos))) {
                    return [
                        new SPLICE(this.pos,
                            concat3(
                                this.old_value.slice(0, other.pos - this.pos),
                                other.new_value,
                                this.old_value.slice(other.pos +
                                    other.old_value.length -
                                    this.pos)
                            ),
                            this.new_value),

                        // other gets clobbered
                        new NO_OP(),
                    ];
                } else if (conflictless && this.pos < other.pos) {
                    return [
                        new SPLICE(
                            this.pos,
                            this.old_value.slice(0, other.pos - this.pos),
                            this.new_value),

                        new SPLICE(
                            this.pos + this.new_value.length,
                            other.old_value.slice(this.pos +
                                this.old_value.length - other.pos),
                            other.new_value)
                    ];
                }
            }
        }],

        ['MOVE', (_other, conflictless) => {
            if (_other instanceof MOVE) {
                let other = _other as MOVE;
                if (this.pos + this.old_value.length < other.pos) {
                    return [
                        new SPLICE(map_index(this.pos, other),
                            this.old_value, this.new_value),
                        new MOVE(other.pos + this.new_value.length -
                            this.old_value.length, other.count, other.new_pos)
                    ];
                }

                if (this.pos >= other.pos + other.count) {
                    return [
                        new SPLICE(map_index(this.pos, other),
                            this.old_value, this.new_value),
                        other
                    ];
                }
            }
        }],

        ['APPLY', (_other, conflictless) => {
            if (_other instanceof APPLY) {
                let other = _other as APPLY;
                // other is after the spliced range
                if (other.pos >= this.pos + this.old_value.length) {
                    return [this, new exports.APPLY(other.pos +
                        this.new_value.length - this.old_value, other.op)];
                }

                // other is before the spliced range
                if (other.pos < this.pos) {
                    return [this, other];
                }

                const old_value = concat3(
                    this.old_value.slice(0, other.pos - this.pos),
                    unelem(other.op.apply(elem(this.old_value, other.pos -
                        this.pos)), this.old_value),
                    this.old_value.slice(other.pos - this.pos + 1));
                if (this.new_value.length == this.old_value.length) {
                    try {
                        const new_value = concat3(
                            this.new_value.slice(0, other.pos - this.pos),
                            unelem(other.op.apply(elem(this.new_value, other.pos
                                - this.pos)),
                                this.old_value),
                            this.new_value.slice(other.pos - this.pos + 1));
                        return [
                            new exports.SPLICE(this.pos, old_value, new_value),
                            other
                        ];
                    } catch (e) {
                    }
                }

                // Otherwise, in conflictless mode, the SPLICE takes precedence.
                if (conflictless) {
                    return [
                        new SPLICE(this.pos, old_value, this.new_value),
                        new NO_OP()
                    ];
                }
            }

            return null;
        }],

        ['MAP', (_other, conflictless) => {
            if (_other instanceof MAP) {
                let other = _other as MAP;

                try {
                    // If this is possible...
                    return [
                        new SPLICE(this.pos,
                            other.apply(this.old_value),
                            other.apply(this.new_value)),
                        other
                    ];
                } catch (e) {

                    if (conflictless)
                        return [
                            new SPLICE(this.pos,
                                other.apply(this.old_value), this.new_value),
                            new NO_OP()
                        ];
                }

                // Can't resolve conflict.
                return null;
            }
            return null;
        }]
    ];

    public pos: any;
    public old_value: any;
    public new_value: any;

    constructor(pos, old_value, new_value) {
        super();

        if (pos === null || old_value === null || new_value === null) {
            throw 'Invalid argument';
        }

        this.pos = pos;
        this.old_value = old_value;
        this.new_value = new_value;

        Object.freeze(this);
    }

    public apply(document: any): any {
        return concat3(document.slice(0, this.pos),
            this.new_value,
            document.slice(this.pos + this.old_value.length));
    }

    public simplify(): BaseOperation {
        if (deepEqual(this.old_value, this.new_value)) {
            return new NO_OP();
        }
        return this;
    }

    public invert(): BaseOperation {
        return new SPLICE(this.pos, this.new_value, this.old_value);
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

        if (_other instanceof SPLICE) {
            let other = _other as SPLICE;
            if (this.pos <= other.pos &&
                other.pos + other.old_value.length <=
                this.pos + this.new_value.length) {
                return new SPLICE(
                    this.pos,
                    this.old_value,
                    concat3(
                        this.new_value.slice(0, other.pos - this.pos),
                        other.new_value,
                        this.new_value.slice(this.new_value.length +
                            (other.pos + other.old_value.length) -
                            (this.pos + this.new_value.length))
                    )
                );
            }

            if (other.pos <= this.pos &&
                this.pos + this.new_value.length <=
                other.pos + other.old_value.length) {
                return new SPLICE(
                    other.pos,
                    concat3(
                        other.old_value.slice(0, this.pos - other.pos),
                        this.old_value,
                        other.old_value.slice(other.old_value.length + (this.pos
                            + this.new_value.length) - (other.pos +
                                other.old_value.length))
                    ),
                    other.new_value
                );
            }
        }
        if (_other instanceof exports.APPLY) {
            let other = _other as APPLY;
            if (other.pos >= this.pos && other.pos
                < this.pos + this.old_value.length) {
                return new exports.SPLICE(
                    this.pos,
                    this.old_value,
                    concat3(
                        this.new_value.slice(0, other.pos - this.pos),
                        unelem(other.apply(elem(this.new_value, other.pos -
                            this.pos)), this.old_value),
                        this.new_value.slice(other.pos - this.pos + 1)
                    ))
                    .simplify();
            }
        }
        return null;
    }
}

export class INS extends SPLICE {
    constructor(pos, value) {
        super(pos, value.slice(0, 0), value);
    }
}

export class DEL extends SPLICE {
    constructor(pos, old_value) {
        super(pos, old_value, old_value.slice(0, 0));
    }
}

export class MOVE extends BaseOperation {
    public op_name = 'MOVE';
    public rebase_functions = [
        ['MOVE', (_other, conflictless) => {
            if (_other instanceof MOVE) {
                let other = _other as MOVE;
                if (this.pos + this.count >= other.pos && this.pos < other.pos +
                    other.count)
                    return null;
                return [
                    new exports.MOVE(map_index(this.pos, other), this.count,
                        map_index(this.new_pos, other)),
                    null
                ];
            }
            return null;
        }],

        ['APPLY', (_other, conflictless) => {
            if (_other instanceof APPLY) {
                let other = _other as APPLY;
                return [
                    this,
                    new APPLY(map_index(other.pos, this), other.op)
                ];
            }
            return null;
        }],

        ['MAP', (_other, conflictless) => {
            return [this, _other];
        }]
    ];

    public pos: any;
    public count: any;
    public new_pos: any;

    constructor(pos, count, new_pos) {
        super();
        if (pos === null || count === null || count === 0 ||
            new_pos === null) {
            throw 'Invalid Argument';
        }

        this.pos = pos;
        this.count = count;
        this.new_pos = new_pos;

        Object.freeze(this);
    }

    public apply(document: any): any {
        if (this.pos < this.new_pos) {
            return concat3(document.slice(0, this.pos),
                document.slice(this.pos + this.count,
                    this.pos),
                document.slice(this.pos, this.pos + this.count) +
                document.slice(this.new_pos));
        }
        else {
            return concat4(document.slice(0, this.new_pos),
                document.slice(this.pos, this.pos + this.count),
                document.slice(this.new_pos, this.pos),
                document.slice(this.pos + this.count));
        }
    }

    public simplify(): BaseOperation {
        if (this.pos === this.new_pos) {
            return new NO_OP();
        }
        return this;
    }

    public invert(): BaseOperation {
        if (this.new_pos > this.pos) {
            return new MOVE(this.new_pos, this.count, this.pos);
        }
        else {
            return new MOVE(this.new_pos, this.count, this.pos + this.count);
        }
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

        if (_other instanceof SPLICE) {
            let other = _other as SPLICE;
            if (this.new_pos === other.pos &&
                this.count === other.old_value.length &&
                other.new_value.length === 0) {
                return new DEL(this.pos, other.old_value);
            }
        }

        if (_other instanceof MOVE) {
            let other = _other as MOVE;
            if (this.new_pos === other.pos && this.count === other.count) {
                return new MOVE(this.pos, other.new_pos, this.count);
            }
        }

        return null;
    }
}

export class APPLY extends BaseOperation {
    public op_name = 'APPLY';
    public rebase_functions = [
        ['APPLY', (_other, conflictless) => {
            if (_other instanceof APPLY) {
                let other = _other as APPLY;
                if (other.pos != this.pos) {
                    return [this, other];
                }

                // If they are at the same location, then rebase the sub-operations.
                const opa = this.op.rebase(other.op, conflictless);
                const opb = other.op.rebase(this.op, conflictless);
                if (opa && opb) {
                    return [
                        (opa instanceof NO_OP) ? new NO_OP() : new
                            exports.APPLY(this.pos, opa),
                        (opb instanceof NO_OP) ? new NO_OP() : new
                            exports.APPLY(other.pos, opb)
                    ];
                }
            }
        }],

        ['MAP', (_other, conflictless) => {
            if (_other instanceof MAP) {
                let other = _other as MAP;
                const opa = this.op.rebase(other.op, conflictless);
                if (!opa) {
                    return null;
                }

                const r = (opa instanceof NO_OP) ? new NO_OP() : new
                    APPLY(this.pos, opa);

                const opb = other.op.rebase(this.op, conflictless);
                if (opa && opb && deepEqual(other.op, opb)) {

                    return [
                        r,
                        other
                    ];
                }
                else {
                    return [
                        r,
                        new LIST([this.invert(), other, r]).simplify()
                    ];
                }
            }
        }]
    ];

    public pos: any;
    public op: BaseOperation;

    constructor(pos, op) {
        super();
        if (pos === null || op === null) {
            throw 'Invalid Argument';
        }

        this.pos = pos;
        this.op = op;

        Object.freeze(this);
    }

    public apply(document: any): any {
        let wut: any = elem(document, this.pos);
        let huh: any = this.op.apply(wut);
        return concat3(
            document.slice(0, this.pos),
            huh,
            document.slice(this.pos + 1, document.length));
    }

    public simplify(): BaseOperation {
        const op = this.op.simplify();
        if (op instanceof NO_OP) {
            return new NO_OP();
        }
        return this;
    }

    public invert() {
        return new APPLY(this.pos, this.op.invert());
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

        if (_other instanceof SPLICE) {
            let other = _other as SPLICE;
            if (this.pos >= other.pos &&
                this.pos < other.pos + other.old_value.length) {
                return new SPLICE(
                    other.pos,
                    concat3(
                        other.old_value.slice(0, this.pos - other.pos),
                        unelem(this.invert().apply(elem(
                            other.old_value, this.pos - other.pos)),
                            other.old_value),
                        other.old_value.slice(this.pos - other.pos + 1)),
                    other.new_value).simplify();
            }
        }

        if (_other instanceof APPLY) {
            let other = _other as APPLY;
            if (this.pos === other.pos) {
                const op2 = this.op.compose(other.op);
                if (op2) {
                    return new APPLY(this.pos, op2);
                }
            }
        }

        return null;
    }

}

export class MAP extends BaseOperation {
    public op_name = 'MAP';
    public rebase_functions = [
        ['MAP', (_other, conflictless) => {
            if (_other instanceof MAP) {
                let other = _other as MAP;
                const opa = this.op.rebase(other.op, conflictless);
                const opb = other.op.rebase(this.op, conflictless);
                if (opa && opb) {
                    return [
                        (opa instanceof NO_OP) ? new NO_OP() : new MAP(opa),
                        (opb instanceof NO_OP) ? new NO_OP() : new MAP(opb)
                    ];
                }
            }
        }]
    ];

    public op: any;

    constructor(op) {
        super();
        if (op === null) {
            throw 'Invalid argument';
        }

        this.op = op;
        Object.freeze(this);
    }

    public apply(document: any): any {
        let d;
        if (typeof document === 'string') {
            d = document.split(/.{0}/); // string -> Array<char>
        }
        else {
            d = document.slice(); // clone
        }

        for (let i = 0; i < d.length; i++) {
            d[i] = this.op.apply(d[i]);
        }

        // reform sequence
        if (typeof document === 'string') {
            return d.join('');
        } else {
            return d;
        }
    }

    public simplify(): BaseOperation {
        const op = this.op.simplify();
        if (op instanceof NO_OP) {
            return new NO_OP();
        }
        return this;
    }

    public invert(): BaseOperation {
        return new MAP(this.op.invert());
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

        if (_other instanceof MAP) {
            let other = _other as MAP;
            const op2 = this.op.compose(other.op);
            if (op2) {
                return new MAP(op2);
            }
        }

        return null;
    }
}

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
    } else {
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
    throw "unhandled problem"
}
