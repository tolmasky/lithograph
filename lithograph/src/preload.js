const expect = require("@lithograph/expect");


module.exports.expect = expect;
module.exports.preload = function (scripts)
{
    for (const [functionSource, ...args] of scripts)
        eval(functionSource)(...args);
}
