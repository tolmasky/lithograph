const { is, data, union } = require("@algebraic/type");
//const { parse } = require("remark");

const MDList = data `MDList`  (
    node    => Object,
    next    => MDList.MDNext);

module.exports = MDList;

MDList.End = data `MDList.End` ();
MDList.MDNext = union `MDNext` (MDList, MDList.End);

MDList.fromArray = function MDListFromArray(array, rest = MDList.End)
{
    return array.reverse()
        .reduce((next, node) => MDList({ node, next }), rest);
}

MDList.toArray = function MDListToArray(list)
{
    return MDList.reduce((array, list) =>
        (array.push(list.node), [array, list.next]), list, []);
}

MDList.reduce = function MDListReduce(f, list, accum)
{
    while (list !== MDList.End)
        [accum, list] = f(accum, list);

    return accum;
}

MDList.concat = function MDListConcat(lhs, rhs)
{
    return MDList.fromArray(MDList.toArray(lhs), rhs);
}

MDList.takeWhile = function MDListTakeWhile(f, list)
{
    const taken = [];

    while (list !== MDList.End)
    {
        if (!f(list.node))
            break;

        taken.push(list.node);
        list = list.next;
    }

    return [MDList.fromArray(taken), list];
}

MDList.parse = function MDListParse(contents, next = MDList.End)
{
    const document = parse(contents);
    const children = document.children.reverse()
        .reduce((next, node) => MDList({ node, next }), next);

    return { document, children };
}