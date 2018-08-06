const { Record, List, Stack } = require("immutable");
const swaptop = (item, stack) =>
    stack.peek() === item ? stack : stack.pop().push(item);

const is = type => object => object instanceof type;
const adopt = (child, parent) =>
    parent.updateIn(["children"], list => list.push(child));

const { parse } = require("remark");
const getInnerText = node => node.type === "text" ?
    node.value :
    node.children.reduce((text, child) => text + getInnerText(child), "");

const schedules = ["Concurrent", "Serial"];

const Metadata = Record({ title:"", disabled:false, schedule:"" }, "Metadata");
const Suite = Record({ type:"Suite", metadata:-1, children:List() }, "Suite");
const Test = Record({ type:"Test", metadata:-1, children:List() }, "Test");
const Block = Record({ type:"Block", code:"" }, "Block");
const Section = Record({ node:-1, metadata:-1, children:List() }, "Section");

const toSection = (function ()
{
    const scheduleRegExp = new RegExp(`\\s*\\((${schedules.join("|")})\\)$`);
    const isEntirelyCrossedOut = heading =>
        heading.children.length === 1 &&
        heading.children[0].type === "delete";

    return function toSection(heading)
    {
        const text = getInnerText(heading);
        const title = text.replace(scheduleRegExp, "");
        const disabled = isEntirelyCrossedOut(heading);

        const match = text.match(scheduleRegExp);
        const schedule = match ? match[1] : schedules[0];
        const metadata = Metadata({ title, disabled, schedule });

        return Section({ node: heading, metadata });
    }
})();

const toSuiteOrTest = function ({ metadata, children })
{
    if (children.size === 0)
        return false;

    const blocks = children.takeWhile(is(Block));

    if (blocks.size === 0)
        return Suite({ metadata, children });

    if (blocks.size === children.size)
        return Test({ metadata, children: blocks });

    const subtitled = subtitle => metadata
        .update("title", title => `${title} (${subtitle})`)
        .set("disabled", false);
    const delineate = (subtitle, children) =>
        ({ metadata: subtitled(subtitle), children });

    const before = Test(delineate("Before", blocks));
    const content = Suite(delineate("Content", children.skip(blocks.size)));

    return Suite(
    {
        metadata: metadata.set("schedule", "Serial"),
        children: List.of(before, content)
    });
}

const markdown =
{
    document(node, filename)
    {
        const metadata = Metadata({ title: filename, schedule:"Concurrent" });
        const root = Section({ node, metadata });
        const EOF = { type:"heading", depth:-1000, children:[] };

        const children = [...node.children, EOF];
        const stack = children.reduce((stack, node) =>
            (markdown[node.type] || (x => x))(stack, node),
            Stack.of(root));

        return toSuiteOrTest(stack.pop().peek());
    },

    code: (stack, { value: code }) =>
        swaptop(adopt(Block({ code }), stack.peek()), stack),

    heading: (stack, heading) => (count =>
        stack
            .skip(count + 1)
            .push(stack.take(count + 1)
                .reduce((child, parent) =>
                    adopt(toSuiteOrTest(child), parent)))
            .push(toSection(heading)))
        (stack.takeWhile(parent => heading.depth <= parent.node.depth).size)
}

/*
console.log(JSON.stringify(markdown.document(parse(`
# TITLE
\`\`\`javascript
5+5
\`\`\`
## TITLE 2
### ~~TITLE 3 (Serial)~~
\`\`\`javascript
5+5
\`\`\``), "blah.md").toJS(), null, 2))


console.log(JSON.stringify(markdown.document(parse(`
# ~~ROOT bye (Serial)~~
\`\`\`javascript
5+5
\`\`\`
  ### THREE (FIRST)...
  ### ~~THREE (SECOND)...~~
 ## something
 \`\`\`javascript
5+5
\`\`\`
`), "blah.md").toJS(), null, 2))*/

