const t = require("@babel/types");
const { isArray } = Array;
const { isList } = require("immutable").List;
const { hasOwnProperty } = Object;
const void0 = t.unaryExpression("void", t.numericLiteral(0));
const nullLiteral = t.nullLiteral();
const { parseExpression } = require("@babel/parser");


module.exports = function valueToExpression(value)
{
    if (typeof value === "undefined")
        return void0;

    if (value === null)
        return nullLiteral;

    if (t.isNode(value))
        return value;

    if (isArray(value))
        return t.arrayExpression(value.map(valueToExpression));

    if (isList(value))
        return valueToExpression(value.toArray());

    if (typeof value === "number")
        return t.numericLiteral(value);

    if (typeof value === "string")
        return t.stringLiteral(value);

    if (typeof value === "boolean")
        return t.booleanLiteral(value);

    if (value instanceof RegExp)
        return t.regExpLiteral(
            value.source,
            (value.global ? "g" : "") +
            (value.ignoreCase ? "i" : "") +
            (value.multiline ? "m" : ""));

    if (typeof value === "object")
        return t.objectExpression(
            Object.keys(value).map(key =>
                t.objectProperty(
                    t.stringLiteral(key),
                    valueToExpression(value[key]))));

    if (typeof value === "function")
        return parseExpression(value + "");

    throw new Error("Converting object to object expression failed");
}
