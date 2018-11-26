const { getKind, union, data, getUnscopedTypename } = require("@algebraic/type");
const ParseFailed = data `ParseFailed` ();

module.exports = parse;

function parse(type, inlineCode)
{
    const kind = getKind(type);
console.log(kind);
    if (kind === union)
        return parseUnion(type, inlineCode);

    if (kind === data)
        return parseData(type, inlineCode);

    throw "OH NO!";
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
