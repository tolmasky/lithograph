const { getKind, union, data, getTypename, getUnscopedTypename } =
    require("@algebraic/type");
const { List, Set, hasBase, getParameters } = require("@algebraic/collections");
const ParseFailed = data `ParseFailed` ();

module.exports = parse;

function parse(type, node)
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

function parseUnion(type, inlineCode)
{console.log("here....");
    for (const component of union.components(type))
    {
        const result = parse(component, inlineCode);

        if (result !== ParseFailed)
            return result;
    }

    return ParseFailed;
}

function parseData(type, inlineCode)
{
    if (data.fields(type).length > 0)
        throw TypeError(
            `Cannot parse non-nullary data type ${getTypename(type)}`);
 
    const typename = getUnscopedTypename(type);

    return inlineCode.value === typename ? type : ParseFailed;
}


/*
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
