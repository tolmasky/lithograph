const { data, string, union, parameterized, is } = require("@algebraic/type");
const { List, Set } = require("@algebraic/collections");
const Strategy = require("./strategy");
const parseInlineCode = require("@lithograph/remark/parse-type");

const Format = union `Format` (
    data `JSON` (),
    data `XML` () );

const OEmbedArguments = data `OEmbedArguments` (
    supportedFormats => Set(Format),
    supportedURLs => Set(URL) );

//console.log(getStrategies.for(OEmbedArguments));

const addf = f => (x, y) => x + f(y);
const getInnerText = node =>
    node.type === "text" || node.type === "inlineCode" ?
    node.value : node.children.reduce(addf(getInnerText), "");

module.exports = function (elements)
{
    console.log(_(OEmbedArguments, elements[0]));

//    const arguments = parseArgumentsFromTable(elements[0]);
    
    console.log(supportedURLs);
//    console.log(elements);
//    console.log("hi");
}

function expect()
{
`# Should JSON
`
}

const Unset = data `Unset` ();
const WorkingArgumentOf = parameterized (T =>
    union `WorkingArgumentOf<${T}>` (Unset, T));
const WorkingArgumentsOf = parameterized (A =>
    data `WorkingArgumentsOf <${A}>` (
        ...data.fields((console.log(A),A))
        .map(([name, type]) => new Function(
            "type", "Unset",
            `return ${name} => [type, Unset]`)
            (WorkingArgumentOf(type), Unset))));

    


function _(type, table)
{
    const strategies = Strategy.for(type);console.log(type);
    const WorkingArguments = WorkingArgumentsOf(type);

    const rows = table.children || [];
    const working = rows.slice(1).reduce(function (working, row)
    {
        const columns = row.children;
        const match = getInnerText(columns[0]);
        const strategy = strategies[match];

        if (!strategy)
            throw TypeError(`Unrecognized table field "${match}".`);

        const { field } = strategy;
        const [type, reduction] = parameterized.parameters(strategy);
        const rtype = parameterized.parameters(type)[0];
        const value = parseInlineCode(rtype, columns[1].children[0]);

        if (reduction === Strategy.Set)
            return WorkingArguments({ ...working, [field]: value });

        const existing = working[field];
        const appended = (is(Unset, existing) ? type() : existing)
            .concat(value);

        return WorkingArguments({ ...working, [field]: appended });
    }, WorkingArguments({}));

    return type(working);
}

/*

function _(type, table)
{
    const strategies = Strategy.for(type).map(;

    const fields = data.fields(type);
    const ParsedArgument = T =>
        union `ParsedArgument<${T}>` (data `Unset` (), T);
    const parsedFields = fields.map(([name, type]) =>
    [
        name,
        
            new Function("type",
                `return ${name} => [type, type.Unset]`)(ParsedArgument(type))))
    const ParsedArguments = data `ParsedArguments <${type}>`
        (...fields.map(([name, type]) =>
            new Function("type",
                `return ${name} => [type, type.Unset]`)(ParsedArgument(type))));

    const rows = table.children || [];
    const parsedArguments = rows.slice(1).reduce(function (parsedArguments, row)
    {
        const columns = row.children;
        const key = getInnerText(columns[0]);
        const value = parse(typesForKeys[key], columns[1]);

//        if (hasBase(List, value) || hasBase(Set, value) && parsedArguments[key] != Unset)
//            return something;

        return ParsedArguments({ ...parsedArguments, [key]: value });
    }, ParsedArguments({}));

    console.log(parsedArguments);
    console.log(table);
}

function toParsedArguments(type)
{
    const fields = data.fields(type);
    

    const nameWithSpaces = name
        .replace(/([^A-Z]|^)([A-Z])(?![A-Z])/g, (_, lowercase, uppercase) =>
            `${!!lowercase ? `${lowercase} ` : ''}${uppercase.toLowerCase()}`)
        .replace(/([A-Z]+)(s?$)?/g, (_, string, rest, offset) =>
            `${offset !== 0 ? ' ' : ''}${string}${rest || ' '}`);

    
}

function RR(name, type)
{


    return { [nameWithSpaces]: children => parse(name, type, children) };

    if (type === boolean) ;


    const isCollection = type.FIXME_isList || type.FIXME_isSet;
    if (!isCollection)
        return { [nameWithSpaces]: 1 }
    console.log(nameWithSpaces);
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
}

function parseEnum()
{
}


function parseFromTable(type, table)
{
    const rows = node.children;
    const rowCount = rows && rows.length;

    if (rowCount !== 1)
        return TypeError("Table with no rows.");

    const pairs = rows.map(({ children: columns }) =>
        [getInnerText(columns[0]), getInnerText(columns[1])])

    const columns = rows[0].children;
    const columnCount = columns && columns.length;

    if (columnCount !== 2)
        return state;

    if (getInnerText(columns[0]) !== "plugin")
        return state;

    const pluginPath = getInnerText(columns[1]);
    const plugin = state.module.require(pluginPath);
    const [children, tail] = (function (next, children = [])
    {
        while (
            next !== MDList.End &&
            (next.node.type !== "heading" || next.node.depth < depth))
        {
            children.push(next.node);
            next = next.next;
        }

        return [children, next];
    })(next);

    const contents = plugin(children);
    
    

}

*/