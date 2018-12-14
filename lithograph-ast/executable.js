const { data, union, is, boolean, string, number } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const getInnerText = require("@lithograph/remark/get-inner-text");
const plugin = require("@lithograph/plugin");

const Section = require("./section");
const Resource = require("./resource");

const ResourceMap = Map(string, Resource);

const Block = data `Block` (
    id          => number,
    title       => string,
    disabled    => [boolean, false],
    resources   => [ResourceMap, ResourceMap()] );

const Position = data `Position` (
    line        => number,
    column      => number );

const Fragment = data `Fragment` (
    filename    => string,
    start       => Position,
    end         => Position,
    value       => string);

Fragment.List = List(Fragment);

Fragment.fromMarkdownNode = function (node, filename)
{
    if (node.type !== "code")
        return false;

    const { position } = node;
    const start = Position(position.start);
    const end = Position(position.end);
    const { value } = node;

    return Fragment({ value, filename, start, end });
}

const Mode = union `Mode` (
    data `Serial` (),
    data `Concurrent` () );

const Executable = union `Executable` (
    data `Test` (
        block => Block,
        fragments => [Fragment.List, Fragment.List()] ),

    data `Suite` (
        block => Block,
        inserted => [boolean, false],
        children => [Executable.List, Executable.List()],
        mode => [Mode, Mode.Concurrent] ) );
const { Test, Suite } = Executable;


Executable.List = List(Executable);

Executable.Block = Block;
Executable.Suite.Mode = Mode;

Suite.fromSection = (function ()
{
    const Module = require("module");
    const { dirname } = require("path");

    return function fromSection (section, filename)
    {
        const paths = Module._nodeModulePaths(dirname(filename));
        const module = Object.assign(
            new Module(filename),
            { filename, paths, loaded: true });

        return Executable.fromSection(section, module)[0];
    }
})();

Executable.fromSection = (function ()
{
    const modes = Object.keys(Suite.Mode).join("|");
    const modeRegExp = new RegExp(`\\s*\\((${modes})\\)$`);
    const isCrossedOut = heading =>
        heading.children.length === 1 &&
        heading.children[0].type === "delete";
    const fromHeading = heading =>
        (([title, key = "Concurrent"], disabled) =>
            ({ disabled, title, mode: Suite.Mode[key] }))
        (getInnerText(heading).split(modeRegExp), isCrossedOut(heading));
    const fromPreamble = (preamble, { filename }) =>
        preamble.reduce(function (accumulated, node)
        {
            const fragments = ((fragment, fragments) =>
                fragment ? fragments.push(fragment) : fragments)
                (Fragment.fromMarkdownNode(node, filename), accumulated[0]);
            const resources = ((resource, resources) => resource ?
                resources.set(resource.name, resource) : resources)
                (Resource.fromMarkdownNode(node, filename), accumulated[1]);
    
            return [fragments, resources];
        }, [Fragment.List(), ResourceMap()]);

    return function fromSection(section, module, id = 0)
    {
        const { preamble, subsections } = plugin(section, module);

        const [fragments, resources] = fromPreamble(preamble, module);
        const hasTest = fragments.size > 0;

        const [children, next] = subsections.reduce(([children, id], section) =>
            (([executable, id]) =>
                [executable ? children.push(executable) : children, id])
            (fromSection(section, module, id)),
            [Executable.List(), hasTest ? id + 3 : id + 1]);
        const hasChildren = children.size > 0;

        if (!hasTest && !hasChildren)
            return [false, id];

        const { disabled, title, mode } = fromHeading(section.heading);
        const block = Block({ id, title, disabled, resources });

        if (!hasChildren)
        {
            const test = Test({ block, fragments });

            return id === 0 ?
                [Suite({ block, children:List(Executable)([test]) }), next] :
                [Test({ block, fragments }), next];
        }

        if (!hasTest)
            return [Suite({ block, mode, children }), next];

        const toBlock = (postfix, offset, id = block.id + offset) =>
            Block({ ...block, title: `${title} (${postfix})`, id });

        const beforeBlock = toBlock("Before", 1);
        const before = Test({ block: beforeBlock, fragments });

        const contentBlock = toBlock("Content", 2);
        const content = Suite({ block: contentBlock, mode, children });

        const asChildren = List(Executable)([before, content]);
        const inserted = true;
        const suite = Suite({ block, inserted, mode: Mode.Serial, children: asChildren });

        return [suite, next];
    }
})();



module.exports = Executable;
