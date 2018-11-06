const { data, union, is, boolean, string, number } = require("@algebraic/type");
const { List, Map } = require("@algebraic/collections");


const Position = data `Position` (
    line        => number,
    column      => number );

const Source = data `Source` (
    filename    => string,
    start       => Position,
    end         => Position );

Source.Position = Position;

const Block = data `Block` (
    id          => number,
    source      => Source,
    title       => string,
    depth       => number,
    disabled    => [boolean, false],
    resources   => [Map(string, string), Map(string, string)()] );

const Fragment = data `Fragment` (
    source      => Source,
    value       => string );

const Mode = union `Mode` (
    data `Serial` (),
    data `Concurrent` () );

const Node = union `Node` (
    data `Test` (
        block => Block,
        fragments => [List(Fragment), List(Fragment)()] ),

    data `Suite` (
        block => Block,
        children => [List(Node), List(Node)()],
        mode => [Mode, Mode.Concurrent] ) );

Node.Suite.Mode = Mode;

const NodePath = union `NodePath` (
    data `Test` (
        test => Node.Test,
        index => number,
        parent => NodePath.Suite),

    union `Suite` (
        data `Nested` (
            suite => Node.Suite,
            index => number,
            parent => NodePath.Suite ),

        data `Root` ( suite => Node.Suite ) ) );

module.exports = NodePath;

NodePath.Suite.children = function (suitePath)
{
    return suitePath.suite.children.map((node, index) =>
        is(Node.Test, node) ?
            NodePath.Test({ test: node, index, parent: suitePath }) :
            NodePath.Suite.Nested({ suite: node, index, parent: suitePath }));
}

NodePath.Suite.child = function (index, suitePath)
{
    const child = suitePath.suite.children.get(index);

    return is(Node.Test, child) ?
        NodePath.Test({ test: child, index, parent: suitePath }) :
        NodePath.Suite.Nested({ suite: child, index, parent: suitePath });
}

NodePath.block = function (nodePath)
{
    return is(NodePath.Test, nodePath) ?
        nodePath.test.block :
        nodePath.suite.block;
}

Node.fromMarkdown = function fromMarkdown (filename)
{
    return require("./from-markdown")(filename);
}

Node.Node = Node;
Node.Source = Source;
Node.Block = Block;
Node.Fragment = Fragment;
Node.Path = NodePath;
Node.NodePath = Node.Path;

module.exports = Node;
