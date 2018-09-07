const { List, Record, Stack } = require("immutable");
const pushIn = (object, keyPath, child) =>
    object.updateIn(keyPath, list => list.push(child));

const SubtypedRecord = require("./subtyped-record");
const Suite = require("./suite");
const Atom = require("./atom");

const identifiers = Suite.subtypes.map(subtype => subtype.identifier);
const Provisional = SubtypedRecord(
    [...identifiers, "Before", "Atom"],
    { node:-1, title:"", disabled:false, children:List() },
    "Provisional");

Provisional.prototype.adopt = function ()
{
    return this.updateIn(["children"], list => list.push(child));
}

Provisional.from = (function ()
{
    const subtypesRegExp =
        new RegExp(`\\s*\\((${identifiers.join("|")})\\)$`);
    const isEntirelyCrossedOut = node =>
        node.children.length === 1 &&
        nbode.children[0].type === "delete";

    return function ProvisionalFrom(heading)
    {
        const text = getInnerText(heading);
        const title = text.replace(subtypesRegExp, "");
        const disabled = isEntirelyCrossedOut(node);

        const match = text.match(subtypesRegExp);
        const subtype = match ? match[1] : identifiers[0];

        return Provisional({ node, title, subtype, disabled });
    }
})();

function finalize(provisional)
{
    const children = provisional.children.reduce((children, child) =>
        !(child instanceof Atom.Block) ?
            children.push(child) :
            children.last() && children.last().subtype === Provisional.Before ?
                pushIn(children,
                    [children.size - 1, "blocks"], child) :
                children.push(
                    Interim.Before({ children:List.of(child) })),
        List());

    if (suiteChildren.size === 0)
        return false;

    const [firstChild] = suiteChildren;

    if (firstChild.subtype !== Interim.Before)
        return Suite[interim.subtype.identifier]({ children:suiteChildren });

    if (suiteChildren.size === 1)
        return Atom({ blocks: firstChild.chilren });

    const { disabled, title, type } = suite;
    const beforeSuite = firstChild.set("title", `${title} (Before)`);
    const contentSuite = Suite({ type, children: suiteChildren.skip(1) });

    const children = List.of(beforeSuite, contentSuite);

    return Suite.Serial({ disabled, title, children });
}

const markdown =
{
    document(node, filename)
    {
        const root = Provisional.Concurrent({ node, title: filename });
        const EOF = { type:"heading", depth:0, children:[] };

        const children = [...node.children, EOF];
        const stack = children.reduce((stack, node) =>
            (markdown[node.type] || (x => x))(stack, node),
            Stack.of(root));

        return stack.pop().peek();
    },

    code: (stack, { value: text }) =>
        stack.swaptop(stack.peek().adopt(Atom.Block({ text }))),

    heading: (stack, heading) =>
        stack.reduce(([stack, child], parent) =>
            (parent => heading.depth <= parent.node.depth ?
                [stack.pop(), finalize(parent)] :
                [stack.swaptop(parent), null])
            (child ? parent.adopt(child) : parent),
            [stack, null])[0].push(Provisional.from(heading))
}

function finalize({ suite })
{
    if (suite.children.size === 0)
        return false;

    const blocks = suite.children.takeWhile(Atom.Block.is);

    if (blocks.size === 0)
        return suite;

    const atomAsChildren = List.of(Atom({ blocks }));

    if (blocks.size === suite.children.size)
        return suite.set("children", atomAsChildren);

    const { disabled, title, subtype } = suite;
    const before = Suite.Serial({ title: `${title} (Before)`, children: atomAsChildren });
    const children = suite.children.skip(blocks.size).unshift(atom);
    

    return Suite.Serial()

    return Suite.Serial({ title, disabled })
    
    const { disabled, title, type } = suite;
    const beforeSuite = firstChild.set("title", `${title} (Before)`);
    const contentSuite = Suite({ type, children: suiteChildren.skip(1) });

    const children = List.of(beforeSuite, contentSuite);

    return Suite.Serial({ disabled, title, children });
}

Stack.prototype.swaptop = function (item)
{
    return this.peek() === item ? this : this.pop().push(item);
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
`), "blah.md").toJS()*/