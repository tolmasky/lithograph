
function NodePath(node, parent)
{
    this.node = node;
    this.parent = parent;
}

NodePath.prototype.child = function (index)
{
    return NodePath(this.node.block.children[index], this);
}

NodePath.prototype.mapChildren = function (f)
{
    return this.node.block.children[index], this);
}

NodePath.prototype[Symbol.iterator] = function * ()
{
    let path = this;

    do
        yield path.node;
    while (path = path.parent)
}

LNode.prototype.toString = function ()
{
    return `@[${Array.from(this, node => node.id).join(", ")}]`;
}

module.exports = NodePath;
