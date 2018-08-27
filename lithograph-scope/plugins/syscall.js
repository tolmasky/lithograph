const t = require("babel-types");
const valueToExpression = require("./value-to-expression");


function syscall(key, value)
{
    return t.yieldExpression(valueToExpression({ [key]: value }));
}

module.exports = syscall;

module.exports.tdz = function tdz({ keys })
{
    return syscall("tdz", { keys });
}

module.exports.declare = function declare({ kind, pairs, pairsGenerator })
{
    const rest = pairs ? { pairs } : { pairsGenerator };

    return syscall("declare", { kind, ...rest });
}
