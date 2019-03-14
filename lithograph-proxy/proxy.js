const { is } = require("@algebraic/type");
const { List } = require("@algebraic/collections");

const Rule = require("./rule");
const { SnapshotConfiguration, toProxyRules } = require("./snapshot-configuration");

const proxy = process.env.SNAPSHOT ?
    require("./proxy-snapshot") :
    async function proxy(browserContext, URL, ...rules)
    {
        const onRequest = toOnRequest(rules);
        const page = await browserContext.newPage();

        await page.setRequestInterception(true);

        page.on("request", onRequest);

        await page.goto(URL);

        return page;
    };

module.exports = proxy;
module.exports.proxy = proxy;

proxy.allow = Rule.Action.Allow;
proxy.block = Rule.Action.Block;
proxy.redirect = (status, location) =>
    Rule.Action.Redirect({ status, location });
proxy.record = SnapshotConfiguration.Record;

Object.assign(proxy, Rule.methods);

proxy.snapshot = function snapshot(filename, ...rules)
{
    const normalizedRules = List(Rule)(rules.length <= 0 ?
        [proxy.all("*anything", SnapshotConfiguration.Record)] :
        rules);

    return SnapshotConfiguration({ filename, rules: normalizedRules });
}

function toOnRequest(ruleOrSnapshots)
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

        return action.callback(request, ...args);
    }
}
