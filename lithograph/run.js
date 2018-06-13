const { List, Map, Range } = require("immutable");
const lithograph = require("./lithograph");
const Pipeline = require("./pipeline");
const forkRequire = require("fork-require");

const testRequest = (keyPath, blocks) =>
    Pipeline.Request({ arguments:[{ blocks, keyPath }] });
const Event = { type: (event, type) => event instanceof type };


(module.exports = async function (group)
{
    const workers = Range(0, 8)
        .map(index => forkRequire(`${__dirname}/test-remote`, index));
    const backlog = gather(group);
    console.log(backlog);
    const pipeline = Pipeline.init({ workers, backlog });
    const server = require("./utility-server");

    program(pipeline, function (pipeline, event)
    {
        if (Event.type(event, Pipeline.Resolved))
            console.log("TEST PASSED!", event);
        else if (Event.type(event, Pipeline.Rejected))
            console.log("TEST FAILED", event);

        const nextPipeline = Pipeline.update(pipeline, event);

        return nextPipeline;
    })(Map());
})(lithograph(process.argv[2]));

function program(state, update, pull)
{
    return function push(event)
    {
        state = update(state, event.set("push", push));

        if (pull)
            pull(state);

        return state;
    };
};

function gather(group, prefix, keyPath = [])
{
    const children = List().concat(...group.children
        .map((child, index) => gather(child, [...keyPath, index])));

    return group.blocks.size <= 0 ?
        children :
        children.push(testRequest(keyPath, group.blocks));
}

function settle(keyPath, index, result, group)
{
    if (keyPath.length - 1 === index) { console.log(group.get("result"));
        return group.set("result", result);}

    const key = keyPath[index];
    const children = group.children;
    const child = children.get(key);
    const nextChild = settle(keyPath, index + 1, result, child);
    const nextChildren = children.set(key, nextChild);

    return group
        .set("children", nextChildren)
        .set("result", nextChildren.reduce(function (result, child)
        {
            if (result === "running" || child.result === "running")
                return "running";

            if (result === "failure" || child.result === "failure")
                return "failure";
    
            if (child.result === "success")
                return "success";
    
            return result;
        }, "initial"));
}


/*

    const child = children.get(key);

    group.setIn(["children", key], );

    const nextChild = ;
    const result = group.reduce(function ()
    {
    }, );
    return group.set("result", 
}

function program(state, update, pull)
{
    return function push(event)
    {
        state = update(state, event);

        if (pull)
            pull(state);

        return state;
    };
};

const { readFileSync } = require("fs");

const { List, Record, Seq, Stack } = require("immutable");
const { Parser } = require("commonmark");

const Block = Record({ language:"", code:"" });
const Group = Record({ title:"", level:1, blocks:List(), children:List(), status:"Initial" });


module.exports = function (path)
{
    const contents = readFileSync(path, "utf-8");
    const parser = new Parser();

    return toGroups(parser.parse(contents));
}

function toGroups(document)
{
    const root = Group({ level: 0 });

    return getChildSeq(document).reduce(function (state, node)
    {
        const { root, stack } = state;

        if (node.type === "heading")
        {
            const level = node.level;
            const title = getInnerText(node);
            const group = Group({ title, level });

            const popped = stack.skipWhile(keyPath =>
                state.getIn(keyPath).level >= level);

            const parentKeyPath = popped.peek();
            const index = state.getIn(parentKeyPath).children.size;
            const keyPath = [...parentKeyPath, "children", index];

            return state
                .setIn(keyPath, group)
                .set("stack", popped.push(keyPath));
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
}*/
