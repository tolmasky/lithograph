const { data, string, union, parameterized, is } = require("@algebraic/type");
const { List, Map, Set } = require("@algebraic/collections");
const { ParseStrategy, Reduction } = require("./from-table/parse-strategy");
const { parse, Failure } = require("@lithograph/remark/parse-type");
const getInnerText = require("@lithograph/remark/get-inner-text");

const Unset = data `Unset` ();
const WorkingArgumentOf = parameterized (T =>
    union `WorkingArgumentOf<${T}>` (Unset, T));
const WorkingArgumentsOf = parameterized (A =>
    data `WorkingArgumentsOf <${A}>` (
        ...data.fields(A)
        .map(([name, type]) => new Function(
            "__type", "__Unset",
            `return ${name} => [__type, __Unset]`)
            (WorkingArgumentOf(type), Unset))));


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
