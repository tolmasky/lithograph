const { Suite, Test, Block, fromMarkdown } = require("./suite");
toGenerator = require("./compile/to-generator.js");
toFunctions = require("./compile/to-functions.js");
const LNode = require("cause/lnode");
const TestPath =
{
    root: node =>
        new LNode({ index:0, node, id:"0" }),
    child: (parent, index, child) => ((data, node) =>
        new LNode({ index, id: `${data.id},${index}`, node }, parent))
        (parent.data, child || parent.data.node.children.get(index))
};
const root = TestPath.root(require("./suite").fromMarkdown("/Users/tolmasky/Desktop/test.md"))

console.log(JSON.stringify(root.data.node, null, 2));
console.log(toGenerator({}, root));
//console.log(toFunctions({x:10},root).get("0")());