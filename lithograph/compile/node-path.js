const { is, data, union, number } = require("@algebraic/type");
const { Test, Suite } = require("@lithograph/ast");


const NodePath = union `NodePath` (
    data `Test` (
        test => Test,
        index => number,
        parent => NodePath.Suite),

    union `Suite` (
        data `Nested` (
            suite => Suite,
            index => number,
            parent => NodePath.Suite ),

        data `Root` ( suite => Suite ) ) );

module.exports = NodePath;

NodePath.Suite.children = function (suitePath)
{
    return suitePath.suite.children.map((node, index) =>
        is(Test, node) ?
            NodePath.Test({ test: node, index, parent: suitePath }) :
            NodePath.Suite.Nested({ suite: node, index, parent: suitePath }));
}

NodePath.Suite.child = function (index, suitePath)
{
    const child = suitePath.suite.children.get(index);

    return is(Test, child) ?
        NodePath.Test({ test: child, index, parent: suitePath }) :
        NodePath.Suite.Nested({ suite: child, index, parent: suitePath });
}

NodePath.block = function (nodePath)
{
    return is(NodePath.Test, nodePath) ?
        nodePath.test.block :
        nodePath.suite.block;
}