const { is } = require("@algebraic/type");
const { List } = require("@algebraic/collections");

const Rule = require("./rule");
const toOnRequest = require("./to-on-request");
const { SnapshotConfiguration, toProxyRules } = require("./snapshot-configuration");

const proxy = process.env.SNAPSHOT ?
    require("./proxy-snapshot") :
    async function proxy(browserContext, ...rules)
    {
        const onRequest = toOnRequest(rules);
        const page = await browserContext.newPage();

        await page.setRequestInterception(true);

        page.on("request", onRequest);

        return page;
    };

module.exports = proxy;
module.exports.proxy = proxy;

proxy.mount = require("./mount");

proxy.allow = Rule.Action.Allow;
proxy.block = Rule.Action.Block;
proxy.redirect = (status, location) =>
    Rule.Action.Redirect({ status, location });
proxy.record = SnapshotConfiguration.Record;
proxy.response = data => Rule.Action.Response({ data });

Object.assign(proxy, Rule.methods);

proxy.snapshot = function snapshot(filename, ...rules)
{
    const normalizedRules = List(Rule)(rules.length <= 0 ?
        [proxy.all("*anything", SnapshotConfiguration.Record)] :
        rules);

    return SnapshotConfiguration({ filename, rules: normalizedRules });
}
