const { normalize, relative } = require("path");
const getCommonPath = require("./get-common-path");

const { List, Map, Range, Record } = require("immutable");
const Pipeline = require("./pipeline");
const forkRequire = require("forked-require");

const Run = Record({ root:-1, states:Map(), pipeline:-1 });
Run.State = Record({ aggregate:1, individual:1, metaDataPath:"", value:-1, start:-1, duration:-1 });

Run.State.RUNNING   = 0;
Run.State.WAITING   = 1;
Run.State.FAILURE   = 2;
Run.State.SUCCESS   = 3;
Run.State.EMPTY     = 4;
Run.State.DISABLED  = 5;

module.exports = function (root, options)
{
    const { concurrency, headless, browserLogs } = options;
    const requires = JSON.stringify(options.requires || []);
    const workers = Range(0, concurrency)
        .map(index => forkRequire(`${__dirname}/test-worker/test-worker.js`,
            Object.assign({ UUID: index, headless, requires },
                browserLogs && { browserLogs })));

    const basePath = getCommonPath(root.children.map(node => node.filename));
    const states = getStates(root, basePath, options.metadata);

    const requests = getUnblockedRequests(states, root);
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

        if (event instanceof Pipeline.Response)
        {
            const request = event.request;
            const keyPath = request.context;
            const states = run.states;

            const { value, push } = event;
            const duration = Date.now() - states.get(keyPath).start;
            const individual = event.rejected ?
                Run.State.FAILURE : Run.State.SUCCESS;

            if (individual === Run.State.FAILURE)
            {
                console.error(run.root.getIn(keyPath).title + " FAILED");
                console.error(value);
            }

            const state = Run.State({ individual, duration, value });
            const updatedStates =
                updateStates(run.root, states, keyPath, state);
            const requests =
                getUnblockedRequests(updatedStates, run.root, keyPath);
            const updatedPipeline = requests.size > 0 ?
                Pipeline.update(pipeline, Pipeline.Enqueue({ requests, push })) :
                pipeline;

            return run
                    .set("states", updatedStates)
                    .set("pipeline", updatedPipeline);
        }

        if (event instanceof Pipeline.Started)
        {
            const start = Date.now();
            const individual = Run.State.RUNNING;
            const state = Run.State({ start, individual });
            const states = event.requests.reduce((states, request) =>
                updateStates(run.root, states, request.context, state),
                run.states);

            return run
                .set("states", states)
                .set("pipeline", pipeline);
        }

        return run.set("pipeline", pipeline);
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

function updateStates(root, states, keyPath, state)
{
    const updated = states.set(keyPath, state);

    return propagateState(root, updated, keyPath);
}

function propagateState(root, states, keyPath)
{
    const node = root.getIn(keyPath);
    const individual = states.get(keyPath).individual;
    const aggregate = node.children.reduce((aggregate, child, index) =>
        aggregate === Run.State.RUNNING ?
            aggregate :
            Math.min(aggregate,
                getStateAggregate(keyPath.push("children", index), states)),
        individual);
    const updated = states.setIn([keyPath, "aggregate"], aggregate);

    return keyPath.size === 0 ?
            updated :
            propagateState(root, updated, keyPath.pop().pop());
}

function getUnblockedRequests(states, root, keyPath = List())
{
    const { value: exports } = states.get(keyPath);

    return root.getIn(keyPath).children.flatMap(function (child, index)
    {
        const childKeyPath = keyPath.push("children", index);
        const { individual, aggregate, metaDataPath } = states.get(childKeyPath);

        if (individual === Run.State.WAITING)
        {
            const { filename, blocks, resources } = child;
            const args = [{ filename, blocks, resources, exports, metaDataPath }];
            const context = childKeyPath;
            const request =
                Pipeline.Request({ arguments: args, context });

            return List.of(request);
        }

        if (individual < Run.State.EMPTY)
            return List();

        if (aggregate >= Run.State.EMPTY)
            return List();

        return getUnblockedRequests(states, root, childKeyPath);
    });
}

function getStates(node, basePath, parentMetaDataPath, keyPath = List())
{
    const individual = 
        node.disbaled ? Run.State.DISABLED :
            node.blocks.size > 0 ?
            Run.State.WAITING : Run.State.EMPTY;

    const metaDataPathAddition = keyPath.size <= 0 ? "" :
        keyPath.size <= 2 ?
            `${relative(basePath, node.filename)}` :
            `${node.title}`;
    const metaDataPath = normalize(`${parentMetaDataPath}/${metaDataPathAddition}`);

    const [states, aggregate] = node.children
        .reduce(function (accum, node, index)
        {
            const childKeyPath = keyPath.push("children", index);
            const states = getStates(node, basePath, metaDataPath, childKeyPath);
            const { aggregate } = states.get(childKeyPath);

            return [accum[0].merge(states), Math.min(accum[1], aggregate)];
        }, [Map(), individual]);

    return states.set(keyPath, Run.State({ individual, aggregate, metaDataPath }));
}

function getStateAggregate(keyPath, states)
{
    const state = states.get(keyPath);

    return state ? state.aggregate : Run.State.EMPTY;
}
