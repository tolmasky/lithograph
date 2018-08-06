const { List, Record, Stack } = require("immutable");
const { parse } = require("remark");

const Code = Record({ type:"Code", text:"" });
const types = ["Concurrent", "Serial", "_Atom", "_Before"];
const SuiteType = type => Object.assign(
    options => Suite({ ...options, type:Suite[type] }),
    { toJS: () => type });
const Suite = Object.assign(
    Record({ node:-1, type:-1, title:"", disabled:false, children:List() }),
    ...types.map(type => ({ [type]: SuiteType(type) })));
const typeRegExp =  
    (public => new RegExp(`\\s*\\((${public.join("|")})\\)$`))
    (types.filter(name => name.charAt(0) !== "_"));
const pushIn = (object, keyPath, child) =>
    object.updateIn(keyPath, list => list.push(child));
const getInnerText = ({ type, children, value }) =>
    type === "text" ?
        value :
        children.reduce((text, child) => text + getInnerText(child), "");
const EOF = { type:"heading", depth:0, children:[] };

const markdown =
{
    document(node, filename)
    {
        const suite = Suite.Concurrent({ node, title: filename });    

        const children = [...node.children, EOF];
        const stack = children.reduce((stack, node) =>
            (markdown[node.type] || (x => x))(stack, node),
            Stack.of(suite));

        return stack.pop().peek();
    },

    code(stack, node)
    {
        const code = Code({ text: node.value });
        const suite = pushIn(stack.peek(), ["children"], code);

        return stack.pop().push(suite);
    },

    heading(stack, node)
    {
        const { depth, children } = node;
        const disabled =
            children.length === 1 && children[0].type === "delete";
        const innerText = getInnerText(node);
        const type = (innerText.match(typeRegExp) || [,types[0]])[1];
        const title = innerText.replace(typeRegExp, "");
        const suite = Suite({ node, type:Suite[type], title, disabled });
        const accumulated = stack.reduce(([stack, child], suite) =>
            (accumulated => depth <= suite.node.depth ?
                [stack.pop(), finalize(accumulated)] :
                accumulated !== suite ?
                    [stack.pop().push(accumulated), null] :
                    [stack, null])
            (child ? pushIn(suite, ["children"], child) : suite),
            [stack, null])[0];

        return accumulated.push(suite);
    }
}

function finalize(suite)
{
    const suiteChildren = suite.children.reduce((children, child) =>
        !(child instanceof Code) ?
            children.push(child) :
            children.last() && children.last().type === Suite._Before ?
                pushIn(children,
                    [children.size - 1, "children"], child) :
                children.push(
                    Suite._Before({ children:List.of(child) })),
        List());

    if (suiteChildren.size === 0)
        return false;

    const [firstChild] = suiteChildren;

    if (firstChild.type !== Suite._Before)
        return suite.set("children", suiteChildren);

    if (suiteChildren.size === 1)
        return suite
            .set("type", Suite._Atom)
            .set("children", firstChild.children);

    const { disabled, title, type } = suite;
    const beforeSuite = firstChild.set("title", `${title} (Before)`);
    const contentSuite = Suite({ type, children: suiteChildren.skip(1) });

    const children = List.of(beforeSuite, contentSuite);

    return Suite.Serial({ node:suite.node, disabled, title, children });
}


markdown.document(parse(`
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
`), "blah.md").toJS()