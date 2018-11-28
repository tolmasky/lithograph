const { data, number, string } = require("@algebraic/type");
const { List, Stack } = require("@algebraic/collections");

const Section = data `Section` (
    depth => number,
    heading => Object,
    preamble => [List(Object), List(Object)()],
    subsections => [SectionList, SectionList()] );
const SectionList = List(Section);

const adopt = (key, item, { [key]: list, ...rest }) =>
    Section({ ...rest, [key]: list.push(item) });
const toSection = heading => Section({ depth: heading.depth, heading });
const toHeading = value =>
    ({ type: "heading", depth:0, children:[{ type: "text", value }] });

Section.fromMarkdown = (function ()
{
    const { readFileSync } = require("fs");
    const { parse } = require("remark");

    return function (filename)
    {
        const document = parse(readFileSync(filename));
        const stack = document.children.reduce((stack, node) =>
            node.type !== "heading" ?
                stack.pop().push(adopt("preamble", node, stack.peek())) :
                collapse(node.depth, stack).push(toSection(node)),
            Stack(Section).of(toSection(toHeading(filename))));

        return collapse(1, stack).peek();
    };
})();

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
    