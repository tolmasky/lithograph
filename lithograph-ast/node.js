const { data, union, is, boolean, string, number } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const Source = require("./source");


const Block = data `Block` (
    id          => number,
    source      => Source,
    title       => string,
    disabled    => [boolean, false],
    resources   => [Map(string, string), Map(string, string)()] );

const Fragment = data `Fragment` (
    source      => Source,
    value       => string );

const Mode = union `Mode` (
    data `Serial` (),
    data `Concurrent` () );

const Node = union `Node` (
    data `Test` (
        block => Block,
        fragments => [List(Fragment), List(Fragment)()] ),

    data `Suite` (
        block => Block,
        children => [List(Node), List(Node)()],
        mode => [Mode, Mode.Concurrent] ) );

Node.Suite.Mode = Mode;

const NodePath = union `NodePath` (
    data `Test` (
        test => Node.Test,
        index => number,
        parent => NodePath.Suite),

    union `Suite` (
        data `Nested` (
            suite => Node.Suite,
            index => number,
            parent => NodePath.Suite ),

        data `Root` ( suite => Node.Suite ) ) );

module.exports = NodePath;

NodePath.Suite.children = function (suitePath)
{
    return suitePath.suite.children.map((node, index) =>
        is(Node.Test, node) ?
            NodePath.Test({ test: node, index, parent: suitePath }) :
            NodePath.Suite.Nested({ suite: node, index, parent: suitePath }));
}

NodePath.Suite.child = function (index, suitePath)
{
    const child = suitePath.suite.children.get(index);

    return is(Node.Test, child) ?
        NodePath.Test({ test: child, index, parent: suitePath }) :
        NodePath.Suite.Nested({ suite: child, index, parent: suitePath });
}

NodePath.block = function (nodePath)
{
    return is(NodePath.Test, nodePath) ?
        nodePath.test.block :
        nodePath.suite.block;
}

Node.fromMarkdown = function fromMarkdown (filename)
{
    return require("./from-markdown")(filename);
}

const { parameterized } = require("@algebraic/type");
const Maybe = parameterized (T =>
    union `Maybe <${T}>` (
        data `Just` (value => T),
        data `Nothing` () ));

const Resource = data `Resource` (
    name => string,
    content => string);

Resource.Maybe = Maybe(Resource);


Node.Node = Node;
Node.Source = Source;
Node.Block = Block;
Node.Fragment = Fragment;
Node.Path = NodePath;
Node.NodePath = Node.Path;

module.exports = Node;



Node.fromSection = (function ()
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
    const fromPreamble = preamble =>
        preamble.reduce(function (accumulated, node)
        {
            const fragments = ((fragment, fragments) =>
                fragment ? fragments.push(fragment) : fragments)
                (Fragment.fromMarkdownNode(node), accumulated[0]);
            const resources = ((resource, resources) => resource ?
                resources.set(resource.name, resource.content) : resources)
                (Resource.fromMarkdownNode(node), accumulated[1]);

            return [fragments, resources];
        }, [Fragment.List(), ResourceMap()]);
    const mergeSources = items =>
        Source.union(Seq(items).map(item => item.source));

    return function (section, id)
    {
        const { preamble, subsections } = section;

        const [fragments, resources] = fromPreamble(preamble);
        const hasTest = fragments.size > 0;

        const [children, next] = subsections.reduce(([children, id], section) =>
            ((element, id) =>
                [element ? children.push(element) : children, id])
            (...Node.fromSelection(selection, hasTest ? id + 3 : id));
        const hasChildren = children.size > 0;

        if (!hasTest && !hasChildren)
            return [false, id];

        const beforeSource = mergeSource(fragments);
        const contentSource = mergeSource(children);
        const source = Source.union([testSource, childrenSource]);

        const { disabled, title, mode } = fromHeading(section.heading);
        const block = Block({ id, source, title, disabled, resources });

        if (!hasChildren)
            return [Test({ block, fragments }), id + 1];

        if (!hasTest)
            return [Suite({ block, mode, children }), id + 1];

        const { title, id } = block;
        const toBlock = (source, postfix, offset, id = id + offset) =>
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

Fragment.fromMarkdownNode = function (node, filename)
{
    if (node.type !== "code")
        return false;

    const source = Source.fromMarkdownNode(node, filename);
    const { value } = node;

    return Fragment({ source, value });
}

Resource.fromMarkdownNode = function (node)
{
    if (node.type === "blockquote" &&
        node.children.length === 2 &&
        children[0].type === "paragraph")
        return false;

    const name = getInnerText(children[0]);
    const content = children[1].value;

    return Resource({ name, content });
}














