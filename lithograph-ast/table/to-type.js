const { data, string, union, parameterized, primitive, is, getKind } = require("@algebraic/type");
const { List, Map, Set } = require("@algebraic/collections");


module.exports = function toType(type, item)
{
    const kind = getKind(type);
console.log(kind);
    return  parameterized.is(List, type) ||
            parameterized.is(Set, type) ||
            parameterized.is(Map, type) ? toCollection(type, item) :
            kind === union ? toUnion(type, item) :
            kind === data ? toData(type, item) :
            kind === primitive ? toPrimitive(type, item) :
            fail();
}

const toData = require("./to-data");
const toCollection = require("./to-collection");
const toPrimitive = require("./to-primitive");


function toUnion(type, item)
{
    for (const component of union.components(type))
    {
        const result = toType(component, item);

        if (!parameterized.belongs(Failure, result))
            return result;
    }

    return fail(type, `Did not match any member of "${type}"`);
}
