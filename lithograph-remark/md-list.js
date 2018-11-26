const { is, data, union } = require("@algebraic/type");
//const { parse } = require("remark");

const MDList = data `MDList`  (
    node    => Object,
    next    => MDList.MDNext);

module.exports = MDList;

MDList.End = data `MDList.End` ();
MDList.MDNext = union `MDNext` (MDList, MDList.End);

MDList.fromArray = function MDListFromArray(array)
{
    return array.reverse()
        .reduce((next, node) => MDList({ node, next }), MDList.End);
}

MDList.reduce = function MDListReduce(f, list, accum)
{
    while (list !== MDList.End)
        [accum, list] = f(accum, list);

    return accum;
}

MDList.parse = function MDListParse(contents, next = MDList.End)
{
    const document = parse(contents);
    const children = document.children.reverse()
        .reduce((next, node) => MDList({ node, next }), next);

    return { document, children };
}