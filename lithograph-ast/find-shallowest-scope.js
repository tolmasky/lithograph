const { is } = require("@algebraic/type");
const { Seq } = require("immutable");
const { Test, Suite } = require("./executable");

const isSerial = suite => suite.mode === Suite.Mode.Serial;
const isConcurrent = suite => suite.mode === Suite.Mode.Concurrent;


// We start by determining where the request for allocation came from by
// backtracking up the stack trace until we find a frame that exists in one of
// our known scopes.
module.exports = function findShallowestScope(backtrace, executable)
{
    // Note: Seq.map is lazy, so although this appears like it will perform the
    // initial search on every frame in the backtrace due to the `map`, we'll
    // actually exit early as soon as we find a match.
    return Seq(backtrace)
        .map(frame => findScope(frame, executable))
        .findLast(scope => scope !== false);
}

function findScope(frame, executable, parent)
{
    // Tests in a Serial Suite share scope, so just return false in this case.
    if (is(Test, executable))
        return  !(parent && isSerial(parent)) &&
                inRangeMap(frame, executable.block.ranges) &&
                executable.block.id;

    if (!inRangeMap(frame, executable.block.ranges))
        return false;

    // Note: Seq.map is lazy, so although this appears like it will perform the
    // initial search on every child due to the `map`, we'll actually exit early
    // as soon as we find a match.
    const child = Seq(executable.children)
        .map(child => findScope(frame, child, executable))
        .find(scope => scope !== false);

    return child === false ? executable.block.id : child;
}

function inRangeMap(frame, rangeMap)
{
    const { line, column, filename } = frame;

    if (!rangeMap.has(filename))
        return false;

    const ranges = rangeMap.get(filename);

    return ranges.some(({ start, end }) =>
        line > start.line && line < end.line ||
        line === start.line && column >= start.column ||
        line === end.line && column <= end.column);
}
