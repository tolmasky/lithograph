const { List, Map, Range, Record } = require("immutable");
const Pipeline = require("./pipeline");
const forkRequire = require("forked-require");

const testRequest = (keyPath, blocks) =>
    Pipeline.Request({ arguments:[{ blocks }], context: keyPath });
const Event = { type: (event, type) => event instanceof type };

const Run = Record({ root:-1, states:Map(), pipeline:-1 });
Run.State = Record({ aggregate:1, individual:1, reason:-1, start:-1, duration:-1 });

Run.State.RUNNING   = 0;
Run.State.WAITING   = 1;
Run.State.FAILURE   = 2;
Run.State.SUCCESS   = 3;
Run.State.EMPTY     = 4;

module.exports = function (root, { browserLogs, concurrency })
{
    const workers = Range(0, concurrency)
        .map(index => forkRequire(`${__dirname}/test-remote`, index));

    const [states, requests] = consolidate(root);
    const pipeline = Pipeline.init({ workers, requests });
    const runState = Run({ root, states, pipeline });

    return new Promise(function (resolve, reject)
    {
        run(runState, function pull(run)
        {
            const { aggregate } = run.states.get(List());

            if (aggregate === Run.State.SUCCESS ||
                aggregate === Run.State.FAILURE)
                resolve([run.root, run.states]);
        });
    });
    
}

function run(run, pull)
{
    return program(run, function (run, event)
    {
        const pipeline = Pipeline.update(run.pipeline, event);
        const updated = (function ()
        {
            if (event instanceof Pipeline.Response)
            {
                const request = event.request;
                const keyPath = request.context;
                const states = run.states;
                
                const reason = event.rejected && event.value;
                const duration = Date.now() - states.get(keyPath).start;
                const individual = event.rejected ?
                    Run.State.FAILURE : Run.State.SUCCESS;

                const state = Run.State({ individual, duration, reason });
                const updated = updateStates(run.root, states, keyPath, state);

                return run.set("states", updated);
            }
            
            if (event instanceof Pipeline.Started)
            {
                const start = Date.now();
                const individual = Run.State.RUNNING;
                const state = Run.State({ start, individual });
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
