let jot = require('./jot');

let doc = {
    key1: 'Hello World!',
    key2: 10
};

console.log('original document', doc);

let user1 = new jot.LIST([
    new jot.REN('key1', 'title'),
    new jot.REN('key2', 'count')
]);

let user2 = new jot.LIST([
    new jot.OBJECT_APPLY('key1', new jot.SET('Hello World!', 'My Program')),
    new jot.OBJECT_APPLY('key2', new jot.MATH('add', 10))
]);

console.log('applying user1', user1.apply(doc));
console.log('applying user2', user2.apply(doc));

let user2_rebased = user2.rebase(user1);

console.log('applying combo', user1.compose(user2_rebased).apply(doc));
