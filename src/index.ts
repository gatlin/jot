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
