const { readFileSync } = require("fs");

const { List, Record, Seq, Stack } = require("immutable");
const { Parser } = require("commonmark");

const Block = Record({ language:"", code:"" });
const Group = Record({ filename:"", title:"", level:1, resources:List(), blocks:List(), children:List(), disabled:false });
const Resource = Record({ URL:"", text:"" });

module.exports = Group;

Group.parse = function ({ title = filename, filename })
{
    const contents = readFileSync(filename, "utf-8");
    const document = new Parser().parse(contents);
    const root = Group({ title, filename, level: 0 });

    return getChildSeq(document).reduce(function (state, node)
    {
        const { root, stack } = state;

        if (node.type === "heading")
        {
            const level = node.level;
            const title = getInnerText(node);
            const disabled = /^~~.+~~$/.test(title);
            const group = Group({ filename, title, level, disabled });

            const popped = stack.skipWhile(keyPath =>
                state.getIn(keyPath).level >= level);

            const parentKeyPath = popped.peek();
            const index = state.getIn(parentKeyPath).children.size;
            const keyPath = [...parentKeyPath, "children", index];

            return state
                .setIn(keyPath, group)
                .set("stack", popped.push(keyPath));
        }

        if (node.type === "block_quote")
        {
            const parentKeyPath = [...stack.peek(), "blocks"];
            const resource = getResource(node);
            const index = state.getIn(parentKeyPath).size;
            const keyPath = [...parentKeyPath, index];

            return resource ? state.setIn(keyPath, resource) : state;
        }

        if (node.type === "code_block")
        {
            const parentKeyPath = [...stack.peek(), "blocks"];
            const index = state.getIn(parentKeyPath).size;
            const keyPath = [...parentKeyPath, index];
            const { info: language, literal: code } = node;

            return state
                .setIn(keyPath, Block({ language, code }));
        }

        return state;
    }, Record({ root, stack: Stack.of(["root"]) })()).root;
}

function getResource(node)
{
    const children = getChildSeq(node);

    if (children.size !== 2)
        return null;

    const [first, second] = children;

    if (second.type !== "code_block")
        return null;

    const URL = getInnerText(first);
    const contents = second.literal;

    return Resource({ URL, contents });
}

function getInnerText(node)
{
    if (node.type === "text")
        return node.literal;

    return getChildSeq(node).reduce((text, child) =>
        text + getInnerText(child), "");
}

function getChildSeq(node)
{
    let child = node.firstChild;
    const next = () => child ?
        { value: [child, child = child.next][0] } :
        { done : true };

    return Seq({ next });
}
