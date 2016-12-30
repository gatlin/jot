/* Re-exports along with some name changes for compatibility with old
   module organization. */

export {
    BaseOperation,
    NO_OP,
    SET,
    MATH,
    LIST
} from './base';

export {
    SPLICE,
    INS,
    DEL,
    MAP,
    APPLY as ARRAY_APPLY
} from './sequences';

export {
    PUT,
    REN,
    REM,
    APPLY as OBJECT_APPLY
} from './objects';

import { BaseOperation } from './base';
import * as values from './values';
import * as sequences from './sequences';
import * as objects from './objects';
import * as meta from './meta';

const ctor_table = {
    'values': {
        'NO_OP': (obj) => {
            return new values.NO_OP();
        },

        'SET': (obj) => {
            return new values.SET(
                obj.old_value,
                obj.new_value
            );
        },

        'MATH': (obj) => {
            return new values.MATH(
                obj.operator,
                obj.operand
            );
        }
    },

    'objects': {
        'PUT': (obj) => {
            return new objects.PUT(
                obj.key,
                obj.value
            );
        },

        'REM': (obj) => {
            return new objects.REM(
                obj.key,
                obj.old_value
            );
        },

        'REN': (obj) => {
            return new objects.REN(
                obj.old_key,
                obj.new_key
            );
        },

        'APPLY': (obj) => {
            return new objects.APPLY(
                obj.key,
                opFromJsonableObject(obj.op)
            );
        }
    },

    'sequences': {
        'SPLICE': (obj) => {
            return new sequences.SPLICE(
                obj.pos,
                obj.old_value,
                obj.new_value
            );
        },

        'MOVE': (obj) => {
            return new sequences.MOVE(
                obj.pos,
                obj.count,
                obj.new_pos
            );
        },

        'APPLY': (obj) => {
            return new sequences.APPLY(
                obj.pos,
                opFromJsonableObject(obj.op)
            );
        },

        'MAP': (obj) => {
            return new sequences.MAP(
                opFromJsonableObject(obj.op)
            );
        }
    },

    'meta': {
        'LIST': (obj) => {
            return new meta.LIST(
                obj.ops.map(o => opFromJsonableObject(o))
            );
        }
    }
};

export function opFromJsonableObject(obj) {
    if (!('_type' in obj)) {
        throw 'Invalid argument: not an operation';
    }

    const module_name = obj['_type']['module'];
    const op_name = obj['_type']['class'];

    return ctor_table[module_name][op_name](obj);
}

export function deserialize(op_json) {
    return opFromJsonableObject(JSON.parse(op_json));
}
