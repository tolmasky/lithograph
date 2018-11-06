const { data, declare, string } = require("@algebraic/type");

// FIXME: When we support data as events we won't need this.
const FIXME_ANY = declare({ is: () => true, serialize:[()=>0,true],deserialize:()=>undefined });
const Log = data `Log` (message => string, fromKeyPath => [FIXME_ANY, undefined]);

Log.prototype.update = function (key, f)
{
    return Log({ ...this, [key]: f(this[key]) });
}

Log.prototype.update = function (key, f)
{
    return Log({ ...this, [key]: f(this[key]) });
}

module.exports = Log;
