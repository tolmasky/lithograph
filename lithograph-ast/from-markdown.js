const { is, data, number, string } = require("@algebraic/type");
const { List, Map, Stack } = require("@algebraic/collections");
const { Node, Block, Source, Test, Suite, Fragment } = require("./node");
const { parse } = require("remark");
const Section = require("./section");

const transform = require("@lithograph/plugin");
const MDList = require("@lithograph/remark/md-list");

const { readFileSync } = require("fs");
const { dirname } = require("path");
const Module = require("module");

const NodeList = List(Node);

const Placeholder = data `Placeholder` (
    mode => Suite.Mode,
    block => Block,
    fragments => [List(Fragment), List(Fragment)()],
    children => [NodeList, NodeList()] );

const State = data `State` (
    stack => Stack(Placeholder),
    next => MDList.MDNext,
    id => number,
    module => Module );

const swaptop = (item, stack) =>
    stack.peek() === item ? stack : stack.pop().push(item);
const adoptIn = (key, child, parent) =>
    parent.update(key, list => list.push(child));

const addf = f => (x, y) => x + f(y);
const getInnerText = node =>
    node.type === "text" || node.type === "inlineCode" ?
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
        const source = getSourceFromSyntaxNode(heading, state.module.filename);
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
        return NodeList();

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
    const nested = NodeList([before, content]);

    return Node.Suite({ block, mode:Suite.Mode.Serial, children:nested });
}

const markdown =
{
    code(state, code)
    {
        const source = getSourceFromSyntaxNode(code, state.module.filename);
        const fragment = Fragment({ source, value: code.value });
        const parent = state.stack.peek();
        const fragments = parent.fragments.push(fragment);
        const updated = Placeholder({ ...parent, fragments });

        return State({ ...state, stack: swaptop(updated, state.stack) });
    },

    heading(state, node)
    {
        const { heading, next } = transform(node, state.next, state.module);
        const { stack } = state;
        const shallower = ({ block }) => heading.depth > block.depth;
        const count = stack.findIndex(shallower) + 1;
        const remaining = stack.skip(count);
        const collapsed = stack.take(count)
            .reduce((child, parent) => Placeholder({ ...parent,
                children: parent.children.concat(toConcrete(child)) }));
        const [updated, placeholder] = toPlaceholder(state, heading);
        const appended = remaining.push(collapsed).push(placeholder);

        return State({ ...updated, next, stack: appended });
    },

    blockquote(state, { children })
    {
        if (children.length !== 2 ||
            children[0].type !== "paragraph")
            return state;

        const name = getInnerText(children[0]);
        const contents = children[1].value;
        const placeholder = state.stack.peek();
        const block = placeholder.block;
        const updatedResources = block.resources.set(name, contents);
        const updatedBlock = Block({ ...block, resources: updatedResources });
        const updatedPlaceholder =
            Placeholder({ ...placeholder, block: updatedBlock });

        return State({ ...state, stack: swaptop(updatedPlaceholder, state.stack) });
    }
}

function to_(section)
{
    const { preamble, subsections } = section;
    const [fragments, resources] = preamble.reduce(function (accumulated, node)
    {
        const fragments = ((fragment, fragments) =>
            fragment ? fragments.push(fragment) : fragments)
            (Fragment.fromMarkdownNode(node));
        const resources = ((resource, resources) => resource ?
            resources.set(resource.name, resource.content) : resources)
            (Resource.fromMarkdownNode(node));

        return [fragments, resources];
    }
    
        if (fragment)
        return node.type === "code" ?
            [fragments.push(Fragment.fromMarkdownCode(node)), resources] :
            [fragments, 
        const { type } = node;
        const isResource =
            type === "blockquote" &&
            node.children.length === 2 &&
            children[0].type === "paragraph";

        const fragments = type !== "code" ?
            accumulated[0] :
            accumulated[0].push(toFragment(node));
        const resources = !isResource ?
            accumulated[1] :
            accumulated[1].set(getInnerText(children[0], children[1].value));

        return [fragments, resources];
    }, [FragmentList(), ResourceMap()]);
    const children = subsections.reduce(function (children, section)
    {
        toElement();
    })
    
}

module.exports = function fromMarkdown(filename)
{
    const paths = Module._nodeModulePaths(dirname(filename));
    const module = Object.assign(
        new Module(filename),
        { filename, paths, loaded: true });

    const root = Section.parse(filename);

    const Undetermined = data `Undetermined` (
        mode => Suite.Mode,
        block => Block,
        fragments => [List(Fragment), List(Fragment)()],
        children => [NodeList, NodeList()] );
    )

    const replacement = plugin(section);
    if (replacement !== section)
        blah(replacement);

    fragments = preamble.map().filter();
    children = subsections.map().filter();

    if (fragments && !children)
        return Test({ id })

    if (fragments && children)
        Suite({ children:[Test{id},Suite(children)] })

    if (children && !fragments)
        Suite({ id, children });
    
    return false;

    while (???)
    {
        const remaining = collapse(stack);
        const top = remaining.peek();

        UNDETERMINED(plugin(top));
        
        
        
        if (stack.peek())
    }

/*
    const source = getSourceFromSyntaxNode(document, filename);
    const title = filename;
    const block = Block({ id:0, source, title, depth:0 });
    const mode = Suite.Mode.Concurrent;
    const stack = Stack(Placeholder).of(Placeholder({ block, mode }));

    const state = reduceWhile(
        state => state.next !== MDList.End,
        ({ next: { node, next }, ...state }) =>
            (markdown[node.type] || (x => x))
            (State({ ...state, next }), node),
        State({ id:1, stack, next:children, module }));

    const top = toConcrete(state.stack.pop().peek());

    if (top.size <= 0)
        return Suite({ block, mode, children:NodeList() });

    const root = is(Test, top) ?
        Suite({ block, mode, children:top }) :
        top;

    return root;*/
}

function reduceWhile(condition, iterate, start)
{
    while (condition(start))
        start = iterate(start);

    return start;
}
