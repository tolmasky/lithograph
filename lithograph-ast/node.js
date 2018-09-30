const { type, boolean, string, number, List, Map } = require("@cause/type");
const Position = type ( Position =>
    [line => number, column => number ] );
const Source = type ( Source =>
    [filename => string, start => Position, end => Position ] );

Source.Position = Position;


const Block = type (Block =>
[
    id => string(""),
    source => Source,
    title => string(""),
    depth => number(-1),
    disabled => boolean(false),
    resources => Map(string, string)
]);

const Fragment = type (Fragment =>
    [ source => Source, value => string ]);

const Mode = type (Mode => [Serial => [], Concurrent => []]);
const Node = type (Node =>
[
    Test => [block => Block, fragments => List(Fragment)],
    Suite => [block => Block, children => List(Node), mode => Mode]
]);

Node.fromMarkdown = function fromMarkdown (filename)
{
    return require("./from-markdown")(filename);
}

Node.Node = Node;
Node.Source = Source;
Node.Block = Block;
Node.Fragment = Fragment;
Node.Mode = Mode;

module.exports = Node;
