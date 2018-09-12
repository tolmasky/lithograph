const { Seq, Record } = require("immutable");

const Position = Record(
{
    line: -1,
    column: -1
}, "Position");

const Source = Record(
{
    filename: "",
    start: Position,
    end: Position
}, "Source");

module.exports = Source;

Source.Position = Position;

Source.spanning = function spanning(nodes)
{
    const ranges = Seq(nodes).map(node => node.source);
    const { start, filename } = ranges.first();
    const { end } = ranges.last();

    return Source({ start, end, filename });
}

Source.fromSyntaxNode = function ({ position }, filename)
{
    const start = Position(position.start);
    const end = Position(position.end);

    return Source({ start, end, filename });
}
