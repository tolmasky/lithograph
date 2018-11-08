const { is, data, number, string, union } = require("@algebraic/type");
const { parse } = require("remark");

const MDList = data `MDList`  (
    node    => Object,
    next    => MDList.MDNext);

module.exports = MDList;

MDList.End = data `MDList.End` ();
MDList.MDNext = union `MDNext` (MDList, MDList.End);

MDList.reduce = function MSListReduce(f, list, accum)
{
    while (list !== MDList.End)
    {
        accum = f(accum, list);
        list = list.next;
    }

    return accum;
}

MDList.parse = function MDListParse(contents, next = MDList.End)
{
    const document = parse(contents);
    const children = document.children.reverse()
        .reduce((next, node) => MDList({ node, next }), next);

    return { document, children };
}