const { Test } = require("../suite");


module.exports = function findScope(position, node)
{
    if (!inRange(position, node.range))
        return false;



    // Note: Seq.map is lazy, so although this appears like it will perform the
    // initial search on every child due to the `map`, we'll actually exit early
    // as soon as we find a match.
    const child = Seq(node.children)
        .map(scope => find(position, scope))
        .find(scope => !!scope);

    return child || scope;
}

function inRange({ line, column }, { start, end })
{
    return  line > start.line && line < end.line ||
            line === start.line && column > start.column ||
            line === end.line && column < end.column;
}

module.exports = LexicalScope;
