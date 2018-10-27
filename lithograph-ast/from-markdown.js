const { is, data, number, string } = require("@algebraic/type");
const { List, Map, Stack } = require("@algebraic/collections");
const { Node, Block, Source, Test, Suite, Fragment } = require("./node");

const Placeholder = data `Placeholder` (
    mode => Suite.Mode,
    block => Block,
    fragments => [List(Fragment), List(Fragment)()],
    children => [List(Node), List(Node)()] );

const State = data `State` (
    stack => Stack(Placeholder),
    id => number,
    filename => string );

const swaptop = (item, stack) =>
    stack.peek() === item ? stack : stack.pop().push(item);
const adoptIn = (key, child, parent) =>
    parent.update(key, list => list.push(child));

const addf = f => (x, y) => x + f(y);
const getInnerText = node => node.type === "text" ?
    node.value : node.children.reduce(addf(getInnerText), "");


function getSourceFromSyntaxNode({ position }, filename)
{
    const start = Source.Position(position.start);
    const end = Source.Position(position.end);

    return Source({ start, end, filename });
}

const toPlaceholder = (function ()
{
    const modes = Object.keys(Suite.Mode).join("|");
    const modeRegExp = new RegExp(`\\s*\\((${modes})\\)$`);
    const parse = text =>
        (([title, key = "Concurrent"]) => [title, Suite.Mode[key]])
        (text.split(modeRegExp));
    const isEntirelyCrossedOut = heading =>
        heading.children.length === 1 &&
        heading.children[0].type === "delete";

    return function toPlaceholder(state, heading)
    {
        const id = state.id;
        const source = getSourceFromSyntaxNode(heading, state.filename);
        const disabled = isEntirelyCrossedOut(heading);
        const [title, mode] = parse(getInnerText(heading));
        const depth = heading.depth;
        const block = Block({ id, title, disabled, depth, source });
        const updatedState = State({ ...state, id: id + 1 });

        return [updatedState, Placeholder({ mode, block })];
    }
})();

function getSpanningSource(first, last)
{
    const { start, filename } = first;
    const { end } = last;

    return Source({ start, end, filename });
}

function toConcrete(placeholder)
{
    const { fragments, children, mode } = placeholder;
    const hasFragments = fragments.size > 0;
    const hasChildren = children.size > 0;

    if (!hasFragments && !hasChildren)
        return false;

    const first = placeholder.block.source;
    const last = hasChildren ?
        children.last().block.source : fragments.last().source;
    const source = getSpanningSource(first, last);
    const block = Block({ ...placeholder.block, source });

    if (!hasFragments)
        return Node.Suite({ block, mode, children });

    if (!hasChildren)
        return Node.Test({ block, fragments });

    const { title, id } = block;
    const beforeSource = getSpanningSource(
        fragments.first().source, fragments.last().source);
    const beforeBlock = Block(
    {
        ...block,
        source: beforeSource,
        title: `${title} (Before)`,
        id: id + 0.1
    });
    const before = Node.Test({ block: beforeBlock, fragments });
    const contentSource = getSpanningSource(
        children.first().block.source, children.last().block.source);
    const contentBlock = Block(
    {
        ...block,
        source: contentSource,
        title: `${title} (Content)`,
        id: id + 0.2
    });
    const content = Node.Suite({ block: contentBlock, mode, children });
    const nested = List(Node)([before, content]);

    return Node.Suite({ block, mode:Suite.Mode.Serial, children:nested });
}

const markdown =
{
    code(state, code)
    {
        const source = getSourceFromSyntaxNode(code, state.filename);
        const fragment = Fragment({ source, value: code.value });
        const parent = state.stack.peek();
        const fragments = parent.fragments.push(fragment);
        const updated = Placeholder({ ...parent, fragments });

        return State({ ...state, stack: swaptop(updated, state.stack) });
    },

    heading(state, heading)
    {
        const { stack } = state;
        const shallower = ({ block }) => heading.depth > block.depth;
        const count = stack.findIndex(shallower) + 1;
        const remaining = stack.skip(count);
        const collapsed = stack.take(count)
            .reduce((child, parent) => Placeholder({ ...parent,
                children: parent.children.push(toConcrete(child)) }));
        const [updated, placeholder] = toPlaceholder(state, heading);
        const appended = remaining.push(collapsed).push(placeholder);

        return State({ ...updated, stack: appended });
    },

    blockquote(state, { children })
    {
        if (children.length !== 2 || children[1].type !== "code")
            return state;

        const name = getInnerText(children[0]);
        const contents = children[1].value;
        const owner = state.stack.peek().updateIn(
            ["block", "resources"],
            resources => resources.set(name, contents));

        return State({ ...state, stack: swaptop(owner, stack) });
    }
}

function fromDocument(document, filename)
{
    const source = getSourceFromSyntaxNode(document, filename);
    const title = filename;
    const block = Block({ id:0, source, title, depth:0 });
    const mode = Suite.Mode.Concurrent;
    const start = Placeholder({ block, mode });

    const position = { start: { line:1, column:1 }, end: { line:1, column:1 } };
    const EOF = { type:"heading", position, depth:1, children:[] };
    const state = [...document.children, EOF].reduce(
        (state, node) => (markdown[node.type] || (x => x))(state, node),
        State({ id: 1, stack: Stack(Placeholder)([start]), filename }));
    // The top of the stack will always be our EOF marker.
    const top = toConcrete(state.stack.pop().peek());
    const root = is(Test, top) ?
        Suite({ block, children:NodeList.of(top) }) :
        top;

    return root;
}

module.exports = (function ()
{
    const { parse } = require("remark");
    const { readFileSync } = require("fs");

    return function fromMarkdown(filename)
    {
        const contents = readFileSync(filename, "utf-8");
        const document = parse(contents);

        return fromDocument(document, filename);
    }
})();
