const { data, union, parameterized, string, getTypename } = require("@algebraic/type");
const { List, Set } = require("@algebraic/collections");

const Reduction = union `Reduction` (
    data `Set` (),
    data `AppendOne` (),
    data `AppendMany` ());

const Strategy = parameterized ((T, R) => 
    data `Strategy<${T}, ${R}>` (
        field => string,
        match => string));

module.exports = Strategy;        
        
Strategy.Strategy = Strategy;
Strategy.Reduction = Reduction;

Strategy.for = function getStrategiesForType(type)
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
                return [Strategy(type, Reduction.Set)({ field, match })];

            if (!match.endsWith("s"))
                return [Strategy(type, Reduction.AppendMany)({ field, match })];

            const withoutS = match.substr(0, match.length - 1);

            return [
                Strategy(type, Reduction.AppendOne)({ field, match:withoutS }),
                Strategy(type, Reduction.AppendMany)({ field, match })];
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
        .replace(/([A-Z]+)(s?$)?/g, (_, string, rest, offset) =>
            `${offset !== 0 ? ' ' : ''}${string}${rest || ' '}`);
}

/*


set =>
append =>
append_many =>

for (field of fields)
    [field].reduce(current, next);

const data `TableField` (
    key => name,
    field => ,
    parse => );

ScalarParameter = T => data `ScalarParameter<${T}>` 

Parameter<string> 

SupportedURL

[shove_into, parse_doodle, type]

(parse)
(append)

function (type)
{
    f(t)
}

const parameterized `Parameter` (T => 
    union (
        Scalar => data `Scalar`,
        Vector => data `Vector`
    ))

const parameterized `ScalarParameter` (T => data ())


T => 1*/

