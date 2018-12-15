const { data, number, string } = require("@algebraic/type");
const { List, Stack } = require("@algebraic/collections");
const template = require("./template");

const Section = data `Section` (
    type        => [string, "Section"],
    depth       => number,
    heading     => Object,
    filename    => string,
    preamble    => [List(Object), List(Object)()],
    subsections => [SectionList, SectionList()] );
const SectionList = List(Section);

const adopt = (key, item, { [key]: list, ...rest }) =>
    Section({ ...rest, [key]: list.push(item) });
const toSection = (filename, heading) =>
    Section({ filename, depth: heading.depth, heading });
const toHeading = value =>
    ({ type: "heading", depth:0, children:[{ type: "text", value }] });

Section.fromMarkdown = (function ()
{
    const { readFileSync } = require("fs");
    const { parse } = require("remark");

    return function (filename, templateType, templateArguments = false)
    {
        const document = parse(readFileSync(filename));
        const stack = document.children
            .map(template(templateType, templateArguments))
            .reduce((stack, node) => node.type !== "heading" ?
                stack.pop().push(adopt("preamble", node, stack.peek())) :
                collapse(node.depth, stack).push(toSection(filename, node)),
                Stack(Section).of(toSection(filename, toHeading(filename))));
        const initial = templateArguments ?
            collapse(1, stack).peek().subsections.get(0) :
            collapse(1, stack).peek();

        return plugins(initial, toModule(filename));
    };
})();

module.exports = Section;

const toModule = (function ()
{
    const Module = require("module");
    const { dirname } = require("path");

    return function toModule(filename)
    {
        const paths = Module._nodeModulePaths(dirname(filename));
        const properties = { filename, paths, loaded: true };

        return Object.assign(new Module(filename), properties);
    };
})();

const plugins = (function ()
{
    const plugin = require("@lithograph/plugin");

    return function plugins(section, module)
    {
        const transformed = plugin(section, module);
        const subsections = transformed.subsections
            .map(section => plugins(section, module));

        return Section({ ...transformed, subsections });
    }
})();

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
    