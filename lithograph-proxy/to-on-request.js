const { is } = require("@algebraic/type");
const Rule = require("./rule");
const { SnapshotConfiguration, Record, toProxyRules } =
    require("./snapshot-configuration");


module.exports = function toOnRequest(ruleOrSnapshots)
{
    const rules = [].concat(...ruleOrSnapshots
        .map(item => is(SnapshotConfiguration, item) ?
           toProxyRules(item) :
           item));

    return function onRequest(request)
    {
        const method = request.method();
        const URL = request.url();
        const [action, args] = Rule.find(rules, method, URL);

        if (action === false ||
            action === Rule.Action.Deny)
            return request.respond({ status: 404 });

        if (action === Rule.Action.Allow)
            return request.continue();

        if (is(Rule.Action.Redirect, action))
        {
            const { status, location } = action;

            return request.respond({ status, headers: { location } });
        }

        if (action === Record)
        {
            const headers =
            {
                ...request.headers(),
                "x-lithograph-proxy-record": "true"
            };

            return request.continue({ headers });
        }

        return action.callback(request, ...args);
    }
}
