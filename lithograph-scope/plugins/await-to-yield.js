const t = require("babel-types");
const syscall = require("./syscall");


module.exports = function awaitToYield()
{
    const visitor =
    {
        AwaitExpression: path =>
            path.replaceWith(syscall("await", path.node.argument))
    };

    return { visitor };
}