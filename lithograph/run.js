const { List, Map, Range, Record } = require("immutable");
const lithograph = require("./lithograph");
const Pipeline = require("./pipeline");
const forkRequire = require("fork-require");

const testRequest = (keyPath, blocks) =>
    Pipeline.Request({ arguments:[{ blocks }], context: keyPath });
const Event = { type: (event, type) => event instanceof type };

const Run = Record({ root:-1, states:Map(), pipeline:-1 });
Run.State = Record({ type:"waiting", reason:-1, consolidated:-1 });

(module.exports = async function (root)
{
    const server = require("./utility-server");
    const workers = Range(0, 8)
        .map(index => forkRequire(`${__dirname}/test-remote`, index));

    const [states, requests] = consolidate(root);
    const pipeline = Pipeline.init({ workers, requests });
    const run = Run({ root, states, pipeline });

    program(run, function (run, event)
    {
        const pipeline = Pipeline.update(run.pipeline, event);
        const states = updateStates(run.states, event);
console.log(states);
        return run
            .set("pipeline", pipeline)
            .set("states", states);
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

function consolidate(node, keyPath = [])
{
    const self = node.blocks.size > 0 ? 
        List.of(testRequest(keyPath, node.blocks)) : List();
    const [children, runnable] = node.children
        .reduce(function (accumulated, child, index)
        {
            const consolidated = consolidate(child, [...keyPath, index]);
            const states = accumulated[0].merge(consolidated[0]);
            const runnable = accumulated[1].concat(consolidated[1]);
    
            return [states, runnable];
        }, [Map(), self]);
    const states = runnable.size <= 0 ?
        children : children.set(keyPath + "", Run.State());

    return [states, runnable];
}

function updateStates(states, event)
{
    if (!(event instanceof Pipeline.Response))
        return states;

    const { request } = event;
    const { context: keyPath } = request;

    const type = event.rejected ? "failure" : "success";
    const state = Run.State({ type });

    console.log(`TEST ${event.rejected ? "FAILED" : "PASSED!"}`, keyPath);

    return states.set(keyPath + "", state);
}



function settle(event, index, group)
{
    const { request: { context: keyPath }, value } = event;

    if (keyPath.length - 1 === index) { console.log(group.get("result"));
        return group.set("result", value);}

    const key = keyPath[index];
    const children = group.children;
    const child = children.get(key);
    const nextChild = settle(event, index + 1, child);
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
