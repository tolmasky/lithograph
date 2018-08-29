const LNode = require("cause/lnode");

module.exports =
{
    root: node =>
        new LNode({ index:0, node, id:"0" }),
    child: (parent, index, child) => ((data, node) =>
        new LNode({ index, id: `${data.id},${index}`, node }, parent))
        (parent.data, child || parent.data.node.children.get(index))
};
