const { data, string } = require("@algebraic/type");
const getInnerText = require("@lithograph/remark/get-inner-text");


const Resource = data `Resource` (
    name        => string,
    content     => string);

Resource.fromMarkdownNode = function (node)
{
    const { type, children } = node;

    if (type !== "blockquote" ||
        children.length !== 2 ||
        children[0].type !== "paragraph")
        return false;

    const name = getInnerText(children[0]);
    const content = children[1].value;

    return Resource({ name, content });
}

module.exports = Resource;
