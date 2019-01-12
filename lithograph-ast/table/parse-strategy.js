const { data, union, parameterized, string, getTypename } = require("@algebraic/type");
const { List, Set } = require("@algebraic/collections");

const Reduction = union `Reduction` (
    data `Set` (),
    data `AppendOne` (),
    data `AppendMany` ());

const ParseStrategy = parameterized ((T, R) => 
    data `ParseStrategy<${T}, ${R}>` (
        field => string,
        match => string));

module.exports = ParseStrategy;        
        
ParseStrategy.ParseStrategy = ParseStrategy;
ParseStrategy.Reduction = Reduction;

ParseStrategy.for = function getStrategiesForType(type)
{
    return [].concat(...data.fields(type)
        .map(function ([field, type])
        {
            const match = fromCamelCaseToSpaces(field);
            const vector =
                parameterized.is(Set, type) ||
                parameterized.is(List, type);

            // For scalars, we only need to worry about matching this exact string.
            if (!vector)
                return [ParseStrategy(type, Reduction.Set)({ field, match })];

            if (!match.endsWith("s"))
                return [ParseStrategy(type, Reduction.AppendMany)({ field, match })];

            const withoutS = match.substr(0, match.length - 1);

            return [
                ParseStrategy(type, Reduction.AppendOne)({ field, match:withoutS }),
                ParseStrategy(type, Reduction.AppendMany)({ field, match })];
        }))
        .reduce((strategies, strategy) =>
            (strategies[strategy.match] = strategy, strategies),
            Object.create(null));
}

function fromCamelCaseToSpaces(string)
{
    return string
        .replace(/([^A-Z]|^)([A-Z])(?![A-Z])/g, (_, lowercase, uppercase) =>
            `${!!lowercase ? `${lowercase} ` : ''}${uppercase.toLowerCase()}`)
        .replace(/([A-Z]+)([A-Z])(?![sA-Z]|$)/g, (_, string, rest, offset) =>
            `${offset !== 0 ? ' ' : ''}${string} ${rest.toLowerCase()}`)
        .replace(/([A-Z]+)(s?)$/g, (_, string, rest, offset) =>
            `${offset !== 0 ? ' ' : ''}${string}${rest}`);
}
