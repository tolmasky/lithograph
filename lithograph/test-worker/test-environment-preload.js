const { expect, mock } = require("./test-environment");

module.exports.expect = expect;
module.exports.mock = mock;

module.exports.preload = function (scripts)
{
    for (const [functionSource, ...args] of scripts)
        eval(functionSource)(...args);
}
