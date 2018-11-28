const { data, number, string, fNamed } = require("@algebraic/type");
const { Map, List, OrderedSet } = require("@algebraic/collections");


const Position = data `Position` (
    line        => number,
    column      => number );

Position.compare = (lhs, rhs) =>
    lhs.line - rhs.line || lhs.column - rhs.column;

const Range = data `Range` (
    start       => Position,
    end         => Position );

Range.compare = (lhs, rhs) =>
    Position.compare(lhs.start, rhs.start) ||
    Position.compare(lhs.end, rhs.end);

const Ranges = OrderedSet(Range);
const RangesMap = Map(string, Ranges);

const Source = data `Source` (
    ranges      => [RangesMap, RangesMap()] );

Source.union = (function ()
{
    const empty = Ranges();
    const union = rhs => lhs =>
        lhs.isEmpty() ? rhs : lhs.union(rhs).sort(Range.compare);

    return fNamed(`Source.union`, sources =>
        (ranges => Source({ ranges }))
        (sources.reduce((lhs, { ranges: rhs }) =>
            lhs.isEmpty() ?
                rhs :
                rhs.reduce((lhs, rhs, filename) =>
                    lhs.update(filename, empty, union(rhs)),
                    lhs),
            RangesMap())));
})();

Source.fromMarkdownNode = function ({ position }, filename = "FILENAME")
{
    const start = Source.Position(position.start);
    const end = Source.Position(position.end);
    const range = Range({ start, end });
    const ranges = RangesMap({ [filename]: Ranges.of(range) });

    return Source({ ranges });
}

Source.Position = Position;
Source.Range = Range;

module.exports = Source;
