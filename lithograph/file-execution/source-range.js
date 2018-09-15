const { Record } = require("immutable");

const Position = Record(
    { line:-1, column:-1 },
    "SourceRange.Position");

const SourceRange = Record(
    { id:-1, start: Position(), end: Position(), filename:-1 },
    "SourceRange");

SourceRange.Position = Position;     

module.exports = SourceRange;
