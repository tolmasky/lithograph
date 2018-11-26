const addf = f => (x, y) => x + f(y);


module.exports = function getInnerText(node)
{
    return node.type === "text" || node.type === "inlineCode" ?
        node.value :
        node.children.reduce(addf(getInnerText), "");
}
