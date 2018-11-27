const { data, number } = require("@algebraic/type");
const { List, Stack } = require("@algebraic/collections");

const Section = data `Section` (
    depth => number,
    heading => Object,
    preamble => [List(Object), List(Object)()],
    subsections => [List(Section), List(Section)()] );

const adopt = (key, item, { [key]: list, ...rest }) =>
    Section({ ...rest, [key]: list.push(item) });
const toSection = heading => Section({ depth: heading.depth, heading });

Section.from = function (nodes)
{
    const stack = nodes.reduce((stack, node) =>
        node.type !== "heading" ?
            stack.pop().push(adopt("preamble", node, stack.peek())) :
            collapse(node.depth, stack).push(toSection(node)),
        Stack(Section).of(Section({ depth:0, heading:{} })));

    return collapse(0, stack).pop();
}

module.exports = Section;

function collapse(depth, stack)
{
    const shallower = section => depth > section.depth;
    const count = stack.findIndex(shallower) + 1;
    const remaining = stack.skip(count);
    const collapsed = stack.take(count)
        .reduce((child, parent) =>
            adopt("subsections", child, parent));

    return remaining.push(collapsed);
}
    