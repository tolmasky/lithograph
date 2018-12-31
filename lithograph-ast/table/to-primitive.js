const toEntries = require("./to-entries");


module.exports = function toPrimitive(type, entries)
{
    if (entries.size !== 1)
        return fail(type,
            `${type} expected single table entry, but got ${entries.size}.`);

    const name = Object.keys(primitives)
        .find(key => primitives[key] === type);

    return to[name](type, entries.get(0));
}

function toString(type, tableColumn)
{
    const [child] = tableColumn.children;

    if (child.type === "link")
        return child.value;

    if (child.type === "inlineCode")
        return child.value;

    const message = `string can only be a link or inline code markdown element.`;

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








