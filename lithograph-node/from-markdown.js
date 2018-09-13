const { Record, Seq, List, Map, Stack } = require("immutable");
const { Suite, Metadata, Source, Test, Fragment } = require("./node");
const { Serial, Concurrent } = Suite;
const State = Record({ stack:Stack(), id:1, filename:-1 }, "State");

const swaptop = (item, stack) =>
    stack.peek() === item ? stack : stack.pop().push(item);
const adopt = (child, parent) =>
    parent.update("children", list => list.push(child));

const addf = f => (x, y) => x + f(y);
const getInnerText = node => node.type === "text" ?
    node.value : node.children.reduce(addf(getInnerText), "");


const toPlaceholder = (function ()
{
    const modes = { Serial, Concurrent };
    const union = Object.keys(modes).join("|");
    const modeRegExp = new RegExp(`\\s*\\((${union})\\)$`);
    const parse = text =>
        (([title, key = "Concurrent"]) => [title, modes[key]])
        (text.split(modeRegExp));
    const isEntirelyCrossedOut = heading =>
        heading.children.length === 1 &&
        heading.children[0].type === "delete";

    return function toPlaceholder(state, heading)
    {
        const id = state.id;
        const source = Source.fromSyntaxNode(heading, state.filename);
        const disabled = isEntirelyCrossedOut(heading);
        const [title, mode] = parse(getInnerText(heading));
        const depth = heading.depth;
        const metadata = Metadata({ id, title, disabled, depth });

        return [state.set("id", id + 1), Suite({ source, mode, metadata })];
    }
})();

function toConcrete(suite)
{console.log("IN: ", suite);
    const { children, mode, metadata } = suite;

    if (children.size <= 0)
        return false;

    const source = Source.spanning([suite, children.last()]);
    const division = children.findIndex(node => !(node instanceof Fragment));

    if (division === 0)
        return suite.set("source", source);

    if (division === -1)
        return Test({ source, metadata, fragments: children });

    const { id } = metadata;
    const subtitled = (subtitle, dx, amount) =>
    {
        const title = `${metadata.title} (${subtitle})`;
        const subset = children.slice(amount);
        const source = Source.spanning(subset);

        return [source, Metadata({ id: id + dx, title }), subset];
    };

    const before =
        ((source, metadata, fragments) =>
            Test({ source, metadata, fragments }))
        (...subtitled("Before", 0.1, division));
    const content =
        ((source, metadata, children) =>
            Suite({ source, metadata, mode, children }))
        (...subtitled("Content", 0.2, children.size - division));
    const nested = List.of(before, content);

    return Suite({ source, metadata, mode:Serial, children:nested });
}

const markdown =
{
    code(state, code)
    {
        const source = Source.fromSyntaxNode(code, state.filename);
        const fragment = Fragment({ source, value: code.value });
        const parent = adopt(fragment, state.stack.peek());

        return state.update("stack", stack => swaptop(parent, stack));
    },

    heading(state, heading)
    {
        const { stack } = state;
        const shallower = ({ metadata }) => heading.depth > metadata.depth;
        const count = stack.findIndex(shallower) + 1;
        const remaining = stack.skip(count);
        const collapsed = stack.take(count).reduce(
            (child, parent) => adopt(toConcrete(child), parent));
        const [updated, placeholder] = toPlaceholder(state, heading);
        const appended = remaining.push(collapsed).push(placeholder);

        return updated.set("stack", appended);
    },

    blockquote(state, { children })
    {
        if (children.length !== 2 || children[1].type !== "code")
            return state;

        const name = getInnerText(children[0]);
        const contents = children[1].value;
        const owner = state.stack.peek().updateIn(
            ["metadata", "resources"],
            resources => resources.set(name, contents));

        return state.update("stack", stack => swaptop(owner, stack));
    }
}

function fromDocument(document, filename)
{
    const source = Source.fromSyntaxNode(document, filename);
    const metadata = Metadata({ id:0, title: filename, depth:0 });
    const suite = Suite({ source, metadata });

    const position = { start: { line:1, column:1 } };
    const EOF = { type:"heading", position, depth:1, children:[] };
    const state = [...document.children, EOF].reduce(
        (state, node) => (markdown[node.type] || (x => x))(state, node),
        State({ id: 1, stack: Stack.of(suite), filename }));

    return toConcrete(state.stack.pop().peek());
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
