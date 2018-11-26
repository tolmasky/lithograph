const { data, string, union, parameterized, is } = require("@algebraic/type");
const { List, Set } = require("@algebraic/collections");
const { ParseStrategy, Reduction } = require("./from-table/parse-strategy");
const parse = require("@lithograph/remark/parse-type");
const getInnerText = require("@lithograph/remark/get-inner-text");

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


module.exports = function fromTable(type, table)
{
    const strategies = ParseStrategy.for(type);
    const WorkingArguments = WorkingArgumentsOf(type);

    const rows = table.children || [];
    const working = rows.slice(1).reduce(function (working, row)
    {
        const [keyColumn, valueColumn] = row.children;
        const match = getInnerText(keyColumn);
        const strategy = strategies[match];

        if (!strategy)
            throw TypeError(`Unrecognized table field "${match}".`);

        const { field } = strategy;
        const [type, reduction] = parameterized.parameters(strategy);
        const atom = reduction === Reduction.Set ?
            type : parameterized.parameters(type)[0];
        const value = parse(atom, valueColumn, Reduction.AppendMany);

        if (reduction === Reduction.Set)
            return WorkingArguments({ ...working, [field]: value });

        const existing = working[field];
        const appended = is(Unset, existing) ?
            type(value) :
            existing.concat(value);

        return WorkingArguments({ ...working, [field]: appended });
    }, WorkingArguments({}));

    return type(working);
}
