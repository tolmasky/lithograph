const { List, Map, Range, Record } = require("immutable");
const lithograph = require("./lithograph");
const Pipeline = require("./pipeline");
const forkRequire = require("fork-require");

const testRequest = (keyPath, blocks) =>
    Pipeline.Request({ arguments:[{ blocks }], context: keyPath });
const Event = { type: (event, type) => event instanceof type };

const Run = Record({ root:-1, states:Map(), pipeline:-1 });
Run.State = Record({ aggregate:1, individual:1, reason:-1 });

Run.State.RUNNING   = 0;
Run.State.WAITING   = 1;
Run.State.FAILURE   = 2;
Run.State.SUCCESS   = 3;
Run.State.EMPTY     = 4;

(module.exports = function (root)
{
    return new Promise(function (resolve, reject)
    {
        e(root, function pull(run)
        {
            const { aggregate } = run.states.get(List());
            console.log(aggregate);
            if (aggregate === Run.State.SUCCESS)
                console.log("ALL TESTS PASSED");
            else if (aggregate === Run.State.FAILURE)
                console.log("FAILED");
        
        });
    });
    
})(lithograph(process.argv[2]));

function e(root, pull)
{
    const server = require("./utility-server");
    const workers = Range(0, 8)
        .map(index => forkRequire(`${__dirname}/test-remote`, index));

    const [states, requests] = consolidate(root);
    const pipeline = Pipeline.init({ workers, requests });
    const run = Run({ root, states, pipeline });

    return program(run, function (run, event)
    {
        const pipeline = Pipeline.update(run.pipeline, event);
        const updated = (function ()
        {
            if (event instanceof Pipeline.Response)
            {
                const request = event.request;
                const keyPath = request.context;
                const state = event.rejected ?
                    Run.State({ individual: Run.State.FAILURE, reason: event.value }) :
                    Run.State({ individual: Run.State.SUCCESS });
                const states = updateStates(run.root, run.states, keyPath, state);
        
                return run.set("states", states);
            }
            
            if (event instanceof Pipeline.Started)
            {
                const state = Run.State({ individual: Run.State.RUNNING });
                const states = event.requests.reduce((states, request) =>
                    updateStates(run.root, states, request.context, state),
                    run.states);

                return run.set("states", states);
            }
        
            return run;
        })();
console.log(JSON.stringify(updated.states, null, 2));
        return updated.set("pipeline", pipeline);
    }, pull)(Map());
}

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

function consolidate(node, keyPath = List())
{
    const hasBlocks = node.blocks.size > 0;
    const self = hasBlocks ? 
        List.of(testRequest(keyPath, node.blocks)) : List();
    const [children, runnable] = node.children
        .reduce(function (accumulated, child, index)
        {
            const consolidated = consolidate(child, keyPath.push("children", index));
            const states = accumulated[0].merge(consolidated[0]);
            const runnable = accumulated[1].concat(consolidated[1]);
    
            return [states, runnable];
        }, [Map(), self]);
    const individual = hasBlocks ? Run.State.WAITING : Run.State.EMPTY;
    const states = runnable.size <= 0 ?
        children : children.set(keyPath, Run.State({ individual }));

    return [states, runnable];
}

function updateStates(root, states, keyPath, state)
{
    const updated = states.set(keyPath, state);

    return propagateState(root, updated, keyPath);
}

function propagateState(root, states, keyPath)
{
    const node = root.getIn(keyPath);
    const aggregate = node.children.reduce((aggregate, child, index) =>
        aggregate === Run.State.RUNNING ?
            aggregate :
            Math.min(aggregate,
                getStateAggregate(keyPath.push("children", index), states)),
        states.get(keyPath).individual);
    const updated = states.setIn([keyPath, "aggregate"], aggregate);

    return keyPath.size === 0 ?
            updated :
            propagateState(root, updated, keyPath.pop().pop());
}

function getStateAggregate(keyPath, states)
{
    const state = states.get(keyPath);

    return state ? state.aggregate : Run.State.EMPTY;
}

/*

function updateStates(states, event)
{
    if (event instanceof Pipeline.Started)
        return event.requests.reduce((states, { context: keyPath }) =>
            keyPath.reduce(([keyPath, states], key) =>
                (keyPath =>
                    [keyPath, states.set(keyPath + "", Run.State.Running)])
                    ([...keyPath, key]),
                [[], states])[1],
            states);

    if (!(event instanceof Pipeline.Response))
        return states;

    const { request } = event;
    const { context: keyPath } = request;

    const status = event.rejected ? "failure" : "success";
    const state = Run.State({ individual: state, aggregate: status });

    return keyPath.reduce(([keyPath, states], key) =>
                (keyPath =>
                    [keyPath, states.set(keyPath + "", Run.State.Running)])
                    ([...keyPath, key]),
                [[], states])[1],
            states);

    console.log(`TEST ${event.rejected ? "FAILED" : "PASSED!"}`, keyPath);

    return states.set(keyPath + "", state);
}

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
