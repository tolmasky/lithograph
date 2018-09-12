const { List, Map, Record } = require("immutable");

const Node = Record(
{
    source: -1,
    contents: -1,
    disabled: false
}, "Node");

Node.Source = require("./source");
Node.Node = Node;

Node.Block = Record(
{
    id: "",
    title:"",
    children: List(),
    resources: Map()
}, "Block");

Node.Serial = Record({ type: "Serial", block: Node.Block() }, "Serial");
Node.Concurrent = Record({ type:"Concurrent", block: Node.Block() }, "Concurrent");
Node.Test = Record({ type: "Test", block: Node.Block() }, "Test");
Node.Code = Record({ value: "" }, "Code");

Node.contains = function (type)
{
    return node => node.contents instanceof type;
}

Node.fromMarkdown = function fromMarkdown (filename)
{
    return require("./from-markdown")(filename);
}

module.exports = Node;
