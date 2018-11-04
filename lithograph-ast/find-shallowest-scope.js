const { is } = require("@algebraic/type");
const { Seq } = require("immutable");
const { Test, Suite } = require("./node");

const isSerial = suite => suite.mode === Suite.Mode.Serial;
const isConcurrent = suite => suite.mode === Suite.Mode.Concurrent;


// We start by determining where the request for allocation came from by
// backtracking up the stack trace until we find a frame that exists in one of
// our known scopes.
module.exports = function findShallowestScope(backtrace, node)
{
    // Note: Seq.map is lazy, so although this appears like it will perform the
    // initial search on every frame in the backtrace due to the `map`, we'll
    // actually exit early as soon as we find a match.
    return Seq(backtrace)
        .map(frame => findScope(frame, node))
        .findLast(scope => scope !== false);
}

function findScope(frame, node, parent)
{
    // Tests in a Serial Suite share scope, so just return false in this case.
    if (is(Test, node))
        return  !(parent && isSerial(parent)) &&
                inSource(frame, node.block.source) &&
                node.block.id;

    if (!inSource(frame, node.block.source))
        return false;

    // Note: Seq.map is lazy, so although this appears like it will perform the
    // initial search on every child due to the `map`, we'll actually exit early
    // as soon as we find a match.
    const child = Seq(node.children)
        .map(child => findScope(frame, child, node))
        .find(scope => scope !== false);

    return child === false ? node.block.id : child;
}

function inSource(frame, source)
{
    if (frame.filename !== source.filename)
        return false;

    const { line, column } = frame;
    const { start, end } = source;

    return  line > start.line && line < end.line ||
            line === start.line && column >= start.column ||
            line === end.line && column <= end.column;
}
