const { data, number, string, fNamed } = require("@algebraic/type");
const { Map, List, Seq, OrderedSet } = require("@algebraic/collections");


const Position = data `Position` (
    line        => number,
    column      => number );

Position.compare = (lhs, rhs) =>
    lhs.line - rhs.line || lhs.column - rhs.column;

// Ideally, this would actually be Range<filename>.
const Range = data `Range` (
    filename    => string,
    start       => Position,
    end         => Position );

Range.compare = (lhs, rhs) =>
    Position.compare(lhs.start, rhs.start) ||
    Position.compare(lhs.end, rhs.end);

Range.fromMarkdownNode = function ({ position }, filename)
{
    const start = Position(position.start);
    const end = Position(position.end);

    return Range({ start, end, filename });
}

const RangeMap = Map(string, OrderedSet(Range));

RangeMap.fromRanges = function (ranges)
{
    return ranges
        .groupBy(range => range.filename)
        .map(ranges => OrderedSet(Range)(ranges.sort(Range.compare)));
}

RangeMap.union = (function ()
{
    const empty = RangeMap();
    const union = rhs => lhs =>
        lhs.isEmpty() ? rhs : lhs.union(rhs).sort(Range.compare);

    return rangeMaps => rangeMaps.reduce((lhsRangeMaps, rhsRangeMaps) =>
        lhsRangeMaps.isEmpty() ?
            rhsRangeMaps :
            rhsRangeMaps.reduce((lhsRangeMaps, rhsRanges, filename) =>
                lhsRangeMaps.update(filename, empty, union(rhsRanges)),
                lhsRangeMaps),
            RangeMap());
})();



Range.Position = Position;
Range.Range = Range;
Range.RangeMap = RangeMap;

module.exports = Range;
