const { is } = require("@algebraic/type");
const { Rule, Action } = require("./rule");
const { SnapshotConfiguration, Record, toProxyRules } =
    require("./snapshot-configuration");


module.exports = function toOnRequest(ruleOrSnapshots, record = false)
{
    const rules = [].concat(...ruleOrSnapshots
        .map(item => is(SnapshotConfiguration, item) ?
           record ? item.rules.toArray() : toProxyRules(item) :
           item));

    return function onRequest(request)
    {
        const method = request.method();
        const URL = request.url();
        const [action, args] = Rule.find(rules, method, URL);

        if (action === false ||
            action === Action.Block)
            return request.respond({ status: 404 });

        if (action === Action.Allow)
            return request.continue();

        if (is(Action.Redirect, action))
        {
            const { status, location } = action;

            return request.respond({ status, headers: { location } });
        }

        if (is(Action.Response, action))
        {
            request.record = true;

            return request.respond(action.data);
        }

        if (action === Record)
        {
            request.record = true;

            return request.continue();
        }

        return action.callback(request, ...args);
    }
}
