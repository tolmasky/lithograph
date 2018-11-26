const { getKind, union, data, is, primitives, parameterized, getUnscopedTypename, getTypename } =
    require("@algebraic/type");
const { List, Set } = require("@algebraic/collections");
const MDList = require("@lithograph/remark/md-list");
const { hasOwnProperty } = Object;

const Failure = parameterized (T =>
    data `Failed <${T}>` (message => string));

module.exports = parse;

function parse(type, node, many)
{
    const list = MDList.fromArray(node.children);
    const [first, rest] = parse.one(type, list);

    if (many)
        return MDList.reduce(
            (every, list) =>
                every.concat([parse.one(type, list)]),
            rest, [first]);

    if (rest !== MDList.End)
        throw TypeError(`Too much markdown`);

    return first;
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

    if (kind === data)
        return parse.data(type, list);

    const primitive = Object.keys(primitives)
        .find(key => primitives[key] === type);

    if (primitive)
        return parse[primitive](node.value);

    throw TypeError("Don't know how to parse " + getTypename(type));
}

parse.boolean = transformEnum({ true: true, false: false });
parse.string = transformInlineCode((_, value) => value);
parse.number = transformInlineCode((_, value) => +value);
parse.regexp = transformInlineCode((_, value) =>
    (([, pattern, flags]) => new RegExp(pattern, flags))
    (value.match(/\/(.*)\/([gimuy]*)$/)));

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

    return Failure(type)({ message });
}

parse.URL = function parseURL(type, list)
{
    const { node, next } = list;

    if (node.type === "link")
        return [new URL(node.url), next];

    if (node.type === "inlineCode")
        return [new URL(node.value), next];

    const message = `URL can only be a link or inline code markdown element.`;

    return Failure(type)({ message });
}

function _parse(type, node)
{
    const children = node.children || [node];
    const typename = getTypename(type);

    if (hasBase(List, type) || hasBase(Set, type))
    {
        const parameter = getParameters(type)[0];

        return children.reduce((collection, node) =>
            node.type === "text" ?
                collection :
                collection.concat(parseInlineCode(parameter, node)),
            type());
    }

    if (children.length > 1 || children.length <= 0)
        throw TypeError(
            `${typename} expects a single inline code markdown element`);

    return parseInlineCode(type, children[0]);
}

function parseInlineCode(type, node)
{
    if (node.type !== "inlineCode")
        throw TypeError(
            `${typename} expects a single inline code markdown element`);

    const kind = getKind(type);

    if (kind === union)
        return parseUnion(type, node);

    if (kind === data)
        return parseData(type, node);

    throw "OH NO";
}

parse.union = function parseUnion(type, list)
{
    for (const component of union.components(type))
    {
        const result = parse.one(component, list);

        if (!is(Failure(component), result))
            return result;
    }

    return Failure(type)({ message: `Did not match any member of "${type}"` });
}

parse.data = function parseData(type, list)
{
    if (data.fields(type).length > 0)
        throw TypeError(
            `Cannot parse non-nullary data type ${getTypename(type)}`);

    const typename = getUnscopedTypename(type);

    return transformEnum({ [typename]: type }, type, list);
}


/*


/*
    if (node.type !== "inlineCode")
        throw TypeError(
            `${getTypename(type)} expects a single inline `+
            `code markdown element, but instead got ${node.type}`);
    const kind = getKind(type);

    if (kind === union)
        return parseUnion(type, node);

    if (kind === data)
        return parseData(type, node);

    if (type === URL)
        return parse.URL(type, node);

    const primitive = Object.keys(primitives)
        .find(key => primitives[key] === type);

    if (primitive)
        return parse[primitive](node.value);

    throw TypeError(type+"");

function parseInlineCode(node)
{
    if (node.type !== `inlineCode`)
        throw TypeError(
            `Expected inline code but instead got ${node.type}`);

    
}

function parseBoolean(name, children)
{
    if (children.length !== 1)
        throw TypeError();

    if (children.type !== `inlineCode`)
        throw TypeError(``);
    
    const innerText = getInnerText(children[0]);
    
    if (innerText === "true")
        return true;

    if (innerText !== "false")
        throw TypeError(``);

    return false;
}*/
