const { Record, Seq, List, Map, Stack } = require("immutable");
const Node = require("./node");
const { Block, Concurrent, Serial, Source, Code, Test } = Node;


const Placeholder = Record(
{
    schedule: Concurrent,
    block: Block(),
    depth: -1000,
}, "Placeholder");

const State = Record({ stack: Stack(), id: 1, filename: -1 });

const swaptop = (item, stack) =>
    stack.peek() === item ? stack : stack.pop().push(item);
const adopt = (child, parent) => parent.updateIn(
    ["contents", "block", "children"],
    list => list.push(child));

const { parse } = require("remark");
const getInnerText = node => node.type === "text" ?
    node.value :
    node.children.reduce((text, child) => text + getInnerText(child), "");

const toPlaceholderNode = (function ()
{
    const schedules = { Serial, Concurrent };
    const scheduleRegExp =
        new RegExp(`\\s*\\((${Object.keys(schedules).join("|")})\\)$`);
    const isEntirelyCrossedOut = heading =>
        heading.children.length === 1 &&
        heading.children[0].type === "delete";

    return function toPlaceholderNode(state, heading)
    {
        const id = state.id;
        const text = getInnerText(heading);
        const title = text.replace(scheduleRegExp, "");
        const block = Block({ id, title });
        const depth = heading.depth;
        const match = text.match(scheduleRegExp);
        const schedule = match ? schedules[match[1]] : Concurrent;
        const contents = Placeholder({ block, schedule, depth });
        const source = Source.fromSyntaxNode(heading, state.filename);
        const disabled = isEntirelyCrossedOut(heading);
        const node = Node({ source, contents, disabled });

        return [state.set("id", id + 1), node];
    }
})();

function toConcrete(node)
{
    const { block, schedule } = node.contents;
    const { children } = block;

    if (children.size === 0)
        return false;

    const source = Source.spanning([node, children.last()]);
    const updated = node.set("source", source);
    const snippets = children.takeWhile(Node.contains(Code));

    if (snippets.size === 0)
        return updated.set("contents", schedule({ block }));

    if (snippets.size === children.size)
        return updated.set("contents", Test({ block }));

    const subtitled = (type, subtitle, dx, children) =>
    {
        const title = `${block.title} (${subtitle})`;
        const block = Block({ id: id + dx, title, children });
        const contents = type({ block });
        
        return Node({ source: Source.spanning(children), contents });
    };

    const before = subtitled(Test, "Before", 0.1, snippets);
    const nested = children.skip(snippets.size);
    const content = subtitled(schedule, "Content", 0.2, nested);
    const serialized = block.set("children", List.of(before, contents));

    return updated.set("contents", Serial({ block: serialized }));
}

const markdown =
{
    code(state, code)
    {
        const contents = Code({ value: code.value });
        const source = Source.fromSyntaxNode(code, state.filename);
        const node = Node({ contents, source });

        return state.update("stack", stack =>
            swaptop(adopt(node, stack.peek()), stack));
    },

    heading(state, heading)
    {
        const { stack } = state;
        const shallower = node => heading.depth > node.contents.depth;
        const count = stack.findIndex(shallower) + 1;
        const remaining = stack.skip(count);
        const collapsed = stack.take(count)
            .reduce((child, parent) => adopt(toConcrete(child), parent));
        const [updated, node] = toPlaceholderNode(state, heading);

        return updated.set("stack", remaining.push(collapsed).push(node));
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

        return state.update("stack", stack => swaptop(owner, stack));
    }
}

function fromDocument(document, filename)
{
    const source = Source.fromSyntaxNode(document, filename);
    const block = Block({ id: 0, title: filename });
    const contents = Placeholder({ block, depth: -10 });
    const node = Node({ contents, source });

    const position = { start: { line:1, column:1 } };
    const EOF = { type:"heading", position, depth: -9, children:[] };
    const state = [...document.children, EOF].reduce(
        (state, node) => (markdown[node.type] || (x => x))(state, node),
        State({ id: 1, stack: Stack.of(node), filename }));

    return toConcrete(state.stack.pop().peek());
}

module.exports = function fromMarkdown(filename)
{
    const contents = require("fs").readFileSync(filename, "utf-8");
    const document = parse(contents);

    return fromDocument(document, filename);
}

