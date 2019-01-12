const { primitives } = require("@algebraic/type");


module.exports = function toPrimitive(type, tableColumn)
{
    return  type === primitives.string ? toString(tableColumn) :
            type === primitives.number ? toNumber(tableColumn) :
            type === primitives.boolean ? toBoolean(tableColumn) :
            type === primitives.regexp ? toRegExp(tableColumn) :
            fail(type, "Unexpected.");
}

function toString(tableColumn)
{console.log("HEY", tableColumn);
    const [child] = tableColumn.children;
console.log(child);
    if (child.type === "link")
        return child.value;

    if (child.type === "inlineCode")
        try
        {
            const string = JSON.parse(child.value);

            return typeof string === "string" ?
                string :
                fail();
        }
        catch (e) { return fail("not a string.") };

    const message = `string can only be a link or inline code markdown element.`;

    return fail(type, message);
}
/*

parse.boolean = transformEnum({ true: true, false: false });
parse.number = transformInlineCode((_, value) => +value);
parse.regexp = transformInlineCode((_, value) =>
    (([, pattern, flags]) => new RegExp(pattern, flags))
    (value.match(/\/(.*)\/([gimuy]*)$/)));

parse.variable = transformInlineCode(function (type, value)
{
    return /^[$A-Z_][0-9A-Z_$]*$/i.test(value) ?
        type({ name: value }) :
        Failure(type)({ message: `Expected variable, but instead got ${value}` });
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

function toType(type, entries)
{
    const kind = getKind(type);

    return  kind === union ? toUnion(type, entries) :
            kind === data ? toData(type, entries) :
            kind === primitive ? toPrimitive(type, entries);
}

function toUnion(type, entries)
{
    for (const component of union.components(type))
    {
        const result = toType(component, entries);

        if (!parameterized.belongs(Failure, result))
            return result;
    }

    return fail(type, `Did not match any member of "${type}"`);
}

function toData()
{
}

function toPrimitive()
{
}

module.exports = function fromTable(type, table, { headers = false } = { })
{
    if (!table || table.type !== "table")
        return Failure(type)({ message:
            `fromTable expected a table element, but instead found ${table}` });

    const strategies = ParseStrategy.for(type);
    const WorkingArguments = WorkingArgumentsOf(type);

    const rows = table.children || [];
    const usable = headers ? rows : rows.slice(1);
    const working = usable.reduce(function (working, row)
    {
        if (Failure.is(working))
            return working;

        const [keyColumn, valueColumn] = row.children;
        const match = getInnerText(keyColumn);
        const strategy = strategies[match];

        if (!strategy)
            return Failure(type)({ message: `Unrecognized table field "${match}".` });

        const { field } = strategy;
        const [fieldType, reduction] = parameterized.parameters(strategy);
        const atom = reduction === Reduction.Set ?
            fieldType : parameterized.parameters(fieldType)[0];
        const value = parse(atom, valueColumn, reduction !== Reduction.Set);

        if (reduction === Reduction.Set)
            return WorkingArguments({ ...working, [field]: value });

        const existing = working[field];
        const appended = is(Unset, existing) ?
            fieldType(value) :
            existing.concat(value);

        return WorkingArguments({ ...working, [field]: appended });
    }, WorkingArguments({}));

    return Failure.is(working) ?
        working :
        type(Map(string, Object)(working)
            .filter(value => value !== Unset).toObject());
}


const document = require("remark").parse(`
| URL |  Result | |
|-------------------------------------|---|-|
| **https://tonic.work/tonic-test**     | \`Unsupported\` | |
| **https://tonic.work/api/tonic-test** | \`Missing\` | |
| **https://tonic.work**  | \`Success\` | |
|   |  • type  |  \`rich\`                | |
|   |  • width        |  \`450\`                 | |
|   |  • on ready    |  \`onEmbedReady\`        | |
| **https://tonic.work/new**  | \`Success\` | |
|   |  • type  |  \`rich\`                | |
|   |  • width        |  \`450\`                 | |
|   |  • on ready    |  \`onEmbedReady\`        | |
| **https://tonic.work/new**  | \`Success\` | |
|   |  • type  |  \`rich\`                | |
|   |  • width        |  \`450\`                 | |
|   |  • on ready    |  \`onEmbedReady\`        | |`);

const table = document.children[0];

console.log(module.exports("t", { table }));






*/

