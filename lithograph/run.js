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

module.exports = function (root)
{
    return new Promise(function (resolve, reject)
    {
        e(root, function pull(run)
        {
            const { aggregate } = run.states.get(List());

            if (aggregate === Run.State.SUCCESS ||
                aggregate === Run.State.FAILURE) {
            console.log("HEY");
                resolve([run.root, run.states]);
            }
        });
    });
    
}

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
