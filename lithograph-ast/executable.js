const { data, union, is, boolean, string, number } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const getInnerText = require("@lithograph/remark/get-inner-text");

const Section = require("./section");
const Source = require("./source");
const Resource = require("./resource");

const ResourceMap = Map(string, Resource);

const Block = data `Block` (
    id          => number,
    source      => Source,
    title       => string,
    disabled    => [boolean, false],
    resources   => [ResourceMap, ResourceMap()] );

const Fragment = data `Fragment` (
    source      => Source,
    value       => string );

Fragment.List = List(Fragment);

Fragment.fromMarkdownNode = function (node, filename)
{
    if (node.type !== "code")
        return false;

    const source = Source.fromMarkdownNode(node, filename);
    const { value } = node;

    return Fragment({ source, value });
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
        children => [Executable.List, Executable.List()],
        mode => [Mode, Mode.Concurrent] ) );
const { Test, Suite } = Executable;


Executable.List = List(Executable);

Executable.Suite.Mode = Mode;

Executable.fromMarkdown = (function ()
{
    const Module = require("module");
    const { dirname } = require("path");

    return function fromMarkdown (filename)
    {
        const paths = Module._nodeModulePaths(dirname(filename));
        const module = Object.assign(
            new Module(filename),
            { filename, paths, loaded: true });
        const section = Section.fromMarkdown(filename);

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
                resources.set(resource.name, resource.content) : resources)
                (Resource.fromMarkdownNode(node, filename), accumulated[1]);
    
            return [fragments, resources];
        }, [Fragment.List(), ResourceMap()]);

    return function fromSection(section, module, id = 0)
    {
        const { preamble, subsections } = section;
        
        const [fragments, resources] = fromPreamble(preamble, module);
        const hasTest = fragments.size > 0;

        const [children, next] = subsections.reduce(([children, id], section) =>
            (([executable, id]) =>
                [executable ? children.push(executable) : children, id])
            (fromSection(section, module, id)),
            [Executable.List(), hasTest ? id + 3 : id]);
        const hasChildren = children.size > 0;

        if (!hasTest && !hasChildren)
            return [false, id];
    
        const beforeSource = Source.union(
            fragments.map(fragment => fragment.source));
        const contentSource = Source.union(
            children.map(child => child.block.source));
        const source = Source.union([beforeSource, contentSource]);

        const { disabled, title, mode } = fromHeading(section.heading);
        const block = Block({ id, source, title, disabled, resources });

        if (!hasChildren)
            return [Test({ block, fragments }), id + 1];

        if (!hasTest)
            return [Suite({ block, mode, children }), id + 1];

        const toBlock = (source, postfix, offset, id = block.id + offset) =>
            Block({ ...block, source, title: `${title} (${postfix})`, id });

        const beforeBlock = toBlock(beforeSource, "Before", 1);
        const before = Test({ block: beforeBlock, fragments });
    
        const contentBlock = toBlock(contentSource, "Content", 2);
        const content = Suite({ block: contentBlock, mode, children });

        const asChildren = List([before, content]);
        const suite = Suite({ block, mode: Mode.Serial, children: asChildren });

        return [suite, next];
    }
})();




module.exports = Executable;



/*
const { parameterized } = require("@algebraic/type");
const Maybe = parameterized (T =>
    union `Maybe <${T}>` (
        data `Just` (value => T),
        data `Nothing` () ));
*/







