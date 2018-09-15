const { Seq } = require("immutable");
const { Test, Suite } = require("./node");
const { Serial, Concurrent } = Suite;

const isTest = node => node instanceof Test;
const isSuite = node => node instanceof Suite;
const hasMode = (mode, node) => node.mode === mode;
const isSerial = node => isSuite(node) && hasMode(node, Serial);
const isConcurrent = node => isSuite(node) && hasMode(node, Concurrent);
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
        .map(item => findScope(item))
        .findLast(node => !!node);
}

function findScope(position, node, parent)
{
    if (!hasBlock(node))
        return false;

    if (isTest(node) && parent && isSerial(parent))
        return false;

    if (!inSource(position, node.source))
        return false;

    // Note: Seq.map is lazy, so although this appears like it will perform the
    // initial search on every child due to the `map`, we'll actually exit early
    // as soon as we find a match.
    const child = Seq(node.contents.block.children)
        .map(node => findScope(position, node))
        .find(node => !!node);

    return child || node && node.contents.block.id;
}

function inSource({ line, column }, { start, end })
{
    return  line > start.line && line < end.line ||
            line === start.line && column > start.column ||
            line === end.line && column < end.column;
}
