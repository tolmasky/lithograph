
module.exports = class NodePath
{
    constructor(node, parent)
    {
        this.node = node;
        this.parent = parent;
    }

    child(index)
    {
        return new NodePath(this.node.children.get(index), this.parent);
    }

    toString()
    {
        return `@[${Array.from(this, node => node.id).join(", ")}]`;
    }

    *[Symbol.iterator]()
    {
        yield this.node;
        this.parent && (yield * this.parent);
    }
}
/*
function NodePath(node, parent)
{
    this.node = node;
    this.parent = parent;
}

NodePath.prototype.child = function (index)
{
    return new NodePath(this.node.children[index], this);
}

NodePath.prototype[Symbol.iterator] = function * ()
{
    let path = this;

    do
        yield path.node;
    while (path = path.parent)
}

NodePath.prototype.toString = function ()
{
    return `@[${Array.from(this, node => node.id).join(", ")}]`;
}

module.exports = NodePath;*/
