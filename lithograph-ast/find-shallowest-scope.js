const { Seq } = require("immutable");
const { Test, Suite } = require("./node");
const { Serial, Concurrent } = Suite;

const isTest = node => node instanceof Test;
const isSuite = node => node instanceof Suite;
const hasMode = (mode, node) => node.mode === mode;
const isSerial = node => isSuite(node) && hasMode(Serial, node);
const isConcurrent = node => isSuite(node) && hasMode(Concurrent, node);
const hasBlock = node =>
    isTest(node) || isSerial(node) || isConcurrent(node);


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
        .findLast(scope => !!scope);
}

function findScope(frame, node, parent)
{
    if (isTest(node) && parent && isSerial(parent))
        return false;

    if (!inSource(frame, node.source))
        return false;

    // Note: Seq.map is lazy, so although this appears like it will perform the
    // initial search on every child due to the `map`, we'll actually exit early
    // as soon as we find a match.
    const child = Seq(node.children)
        .map(child => findScope(frame, child, node))
        .find(scope => !!scope);

    return child || node && node.metadata.id;
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
