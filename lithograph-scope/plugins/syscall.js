const t = require("babel-types");
const valueToExpression = require("./value-to-expression");

module.exports = function syscall(key, value)
{
    return t.yieldExpression(valueToExpression({ [key]: value }));
}
