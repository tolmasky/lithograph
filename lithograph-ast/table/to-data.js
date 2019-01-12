const { data, string, union, parameterized, is, getUnscopedTypename } = require("@algebraic/type");
const { Map } = require("@algebraic/collections");
const { ParseStrategy, Reduction } = require("./parse-strategy");
const { parse, Failure } = require("@lithograph/remark/parse-type");
const { Entry } = require("./to-pairs");

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


module.exports = function toData(type, item)
{
    if (data.fields(type).length === 0)
    {
        return  is(Entry, item) ?
                    Failure(type)({ message: "not this" }) :
                item.children.length !== 1 ||
                item.children[0].type !== "inlineCode" ||
                item.children[0].value !== getUnscopedTypename(type) ?
                    Failure(type)({ message: "not this" }) :
                    type;
}
    const strategies = ParseStrategy.for(type);
    const WorkingArguments = WorkingArgumentsOf(type);
    const working = entries.reduce(function (working, entry)
    {
        if (Failure.is(working))
            return working;

        const { key } = entry;
        const strategy = strategies[key];

        if (!strategy)
            return Failure(type)({ message: `Unrecognized table field "${key}".` });

        const { field } = strategy;
        const [fieldType, reduction] = parameterized.parameters(strategy);
        const atom = reduction === Reduction.Set ?
            fieldType : parameterized.parameters(fieldType)[0];
        const value = parse(atom, entry.value, reduction !== Reduction.Set);

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
