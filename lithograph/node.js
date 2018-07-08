const { readFileSync } = require("fs");

const { List, Map, Record, Seq, Stack } = require("immutable");
const { Parser } = require("commonmark");

const Block = Record({ language:"", code:"" });
const Group = Record({ filename:"", title:"", level:1, resources:Map(), blocks:List(), children:List(), disabled:false });
const Resource = Record({ name:"", contents:"" });

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
            const text = getInnerText(node);
            const disabled = text.match(/^~~(.+)~~$/);
            const title = disabled ? disabled[1] : text;
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
            const resource = getResource(node);

            if (!resource)
                return state;

            const keyPath = [...stack.peek(), "resources", resource.name];

            return state.setIn(keyPath, resource);
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
    const children = getChildSeq(node).toList();

    if (children.size !== 2)
        return null;

    const [first, second] = children;

    if (second.type !== "code_block")
        return null;

    const name = getInnerText(first);
    const contents = second.literal;

    return Resource({ name, contents });
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
