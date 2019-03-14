const { data, union, string, ftype, is, getUnscopedTypename } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");

const Route = union `Route` (
    data `Exact` (URL => string),
    data `Pattern` (match => ftype) );

Route.fromPattern = (function ()
{
    const Parser = require("route-parser");
    const toMatch = pattern =>
        (route => string => route.match(string))(new Parser(pattern));

    return pattern => Route.Pattern({ match: toMatch(pattern) });
})();

const Action = union `Action` (
    data `Deny` (),
    data `Allow` (),
    data `Custom` ( callback => ftype) );

const Method = union `Method` (
    ...["GET", "HEAD", "POST", "PUT", "DELETE",
        "CONNECT", "OPTIONS", "TRACE", "PATCH"]
    .map(name => data([name]) ()));

const Rule = data `Rule` (
    methods => Set(Method),
    route   => Route,
    action  => Action );

const toRoute = route => typeof route === "string" ?
    Route.fromPattern(route) : route
const methodConvinience = methods => (route, action) =>
    Rule({ action, methods, route: toRoute(route) });

Rule.methods =
{
    ...union.components(Method)
        .map(method => [getUnscopedTypename(method), Set(Method)([method])])
        .reduce((value, [name, methods]) =>
            (value[name.toLowerCase()] = methodConvinience(methods),
            value), { }),
    all: methodConvinience(Set(Method)(union.components(Method)))
}

Rule.find = function (rules, method, URL)
{
    for (const rule of rules)
    {
        if (!rule.methods.has(Method[method]))
            continue;

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
module.exports.Method = Method;
module.exports.Route = Route;
module.exports.Action = Action;
