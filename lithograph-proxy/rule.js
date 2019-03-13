const { data, union, string, ftype, is } = require("@algebraic/type");

const Route = union `Route` (
    data `Exact` (URL => string),
    data `Pattern` (match => ftype) );

Route.parse = (function ()
{
    const Parser = require("route-parser");
    const toMatch = pattern =>
        (route => string => route.match(string))(new Parser(pattern));
    const fParseRegExp = /^[A-Za-z0-9]+\s+\=\>\s+"(.*)"$/;

    return string => 
        ((original, matches) => matches ?
            Route.Pattern({ match: toMatch(matches[1]) }) :
            Route.Exact({ URL: original }))
        (string, string.match(fParseRegExp));
})();

const Action = union `Action` (
    data `Deny` (),
    data `Allow` (),
    data `Custom` ( callback => ftype) );

Action.parse = (function ()
{
    return value =>
        is(Action, value) ? value :
        value === "deny" ? Action.Deny :
        value === "allow" ? Action.Allow :
        Action.Custom({ callback: value });
})();

const Rule = data `Route` (
    route => Route,
    action => Action );

Rule.parse = function (object)
{
    return Object
        .entries(object)
        .map(([key, value]) =>
            [Route.parse(key), Action.parse(value)])
        .map(([route, action]) => Rule({ route, action }));
}

Rule.find = function (rules, URL)
{
    for (const rule of rules)
    {
        const isExact = is(Route.Exact, rule.route);
        const result = isExact ?
            rule.route.URL === URL :
            rule.route.match(URL);

        if (!result)
            continue;

        return [rule.action, isExact ? [] : [result]];
    }

    return [false, []];
}

module.exports = Rule;
module.exports.Rule = Rule;
module.exports.Route = Route;
module.exports.Action = Action;
