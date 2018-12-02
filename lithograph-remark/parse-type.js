const { getKind, union, data, is, string, primitives, parameterized, getUnscopedTypename, getTypename } =
    require("@algebraic/type");
const MDList = require("./md-list");
const { hasOwnProperty } = Object;

const Failure = parameterized (T =>
    data `Failed <${T}>` (message => string));
const Variable = parameterized (T =>
    data `Variable <${T}>` (name => string));

Failure.is = failure => parameterized.belongs(Failure, failure);
Variable.is = variable => parameterized.belongs(Variable, variable);

const fail = (type, message) => [Failure(type)({ message }), MDList.End];


module.exports = parse;

module.exports.parse = parse;
module.exports.Failure = Failure;
module.exports.Variable = Variable;

function parse(type, node, many)
{
    const list = MDList.fromArray(node.children);
    const [result, rest] =  (many ? parse.many : parse.one)(type, list);

    if (parameterized.belongs(Failure, result))
        throw TypeError(result.message);

    if (rest !== MDList.End)
        throw TypeError(`Too much markdown`);

    return result;
}

parse.many = function (type, list)
{
    const array = MDList.reduce(function (array, list)
    {
        if (list.node.type === `text`)
            return [array, list.next];

        const [result, rest] = parse.one(type, list);

        return parameterized.belongs(Failure, result) ?
            [result, rest] :
            [array.concat([result]), rest];
    }, list, []);

    if (parameterized.belongs(Failure, array) || array.length > 0)
        return [array, MDList.End];

    return fail(type, `Found no instances of ${type}`);
}

parse.one = function (type, list)
{
    if (list === MDList.End)
        throw TypeError(
            `Unexpected empty markdown when looking for ${getTypename(type)}`);

    if (type === URL)
        return parse.URL(type, list);

    const kind = getKind(type);

    if (kind === union)
        return parse.union(type, list);

    if (parameterized.is(Variable, type))
        return parse.variable(type, list);

    if (kind === data)
        return parse.data(type, list);

    const primitive = Object.keys(primitives)
        .find(key => primitives[key] === type);

    if (primitive)
        return parse[primitive](type, list);

    throw TypeError("Don't know how to parse " + getTypename(type));
}

parse.boolean = transformEnum({ true: true, false: false });
parse.number = transformInlineCode((_, value) => +value);
parse.regexp = transformInlineCode((_, value) =>
    (([, pattern, flags]) => new RegExp(pattern, flags))
    (value.match(/\/(.*)\/([gimuy]*)$/)));

parse.variable = transformInlineCode(function (type, value)
{
    return /^[$A-Z_][0-9A-Z_$]*$/i.test(value) ?
        type({ name: value }) :
        fail(type, `Expected variable, but instead got ${value}`);
});

function transformEnum(...args)
{
    if (args.length < 3)
        return (...more) => transformEnum(...args, ...more);

    const [values, ...rest] = args;

    return transformInlineCode(function (type, value)
    {
        if (hasOwnProperty.call(values, value))
            return values[value];

        const quoted = Object.keys(values).map(value => `"${value}"`);
        const message = `${type} must be one of either ${quoted.join(", or ")}`;

        return Failure(type)({ message });
    }, ...rest);
}

function transformInlineCode(...args)
{
    if (args.length < 3)
        return (...more) => transformInlineCode(...args, ...more);

    const [f, type, list] = args;
    const { node, next } = list;

    if (node.type === "inlineCode")
        return [f(type, node.value), next];

    const message =
        `${getTypename(type)} expects a single inline ` +
        `code markdown element, but instead found ${node.type}`

    return fail(type, message);
}

parse.string = function parseString(type, list)
{
    const { node, next } = list;

    if (node.type === "link")
        return [node.url, next];

    if (node.type === "inlineCode")
        return [node.value, next];

    const message = `string can only be a link or inline code markdown element.`;

    return fail(type, message);
}

parse.URL = function parseURL(type, list)
{
    const { node, next } = list;

    if (node.type === "link")
        return [new URL(node.url), next];

    if (node.type === "inlineCode")
        return [new URL(node.value), next];

    const message = `URL can only be a link or inline code markdown element.`;

    return fail(type, message);
}

parse.union = function parseUnion(type, list)
{
    for (const component of union.components(type))
    {
        const [result, next] = parse.one(component, list);

        if (!parameterized.belongs(Failure, result))
            return [result, next];
    }

    return fail(type, `Did not match any member of "${type}"`);
}

parse.data = function parseData(type, list)
{
    if (data.fields(type).length > 0)
        throw TypeError(
            `Cannot parse non-nullary data type ${getTypename(type)}`);

    const typename = getUnscopedTypename(type);

    return transformEnum({ [typename]: type }, type, list);
}
