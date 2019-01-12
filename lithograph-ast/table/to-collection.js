const { parameterized } = require("@algebraic/type");
const toType = require("./to-type");


module.exports = function toCollection(type, item)
{
    const types = parameterized.parameters(type);
    const { entries } = item;
console.log(types.length);
    return type(types.length === 1 ?
        entries.map(entry => toType(types[0], entry)) :
        entries.map(({ key, value }) => [key, toType(types[1], value)]));
}
