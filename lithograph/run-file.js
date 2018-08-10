const { Record, List, Map, Range } = require("immutable");
const { Suite, Test, Block, fromMarkdown } = require("./suite");

const Queue = require("./pipeline");

const Path = Record({ parent: null, node:-1, index:-1 });
const Run = Record({ queue: -1, results:Map(), starts:Map() });

console.log("--->" + global.process.pid);
Suite.Serial = "Serial";
Suite.Concurrent = "Concurrent";


module.exports = function (filename)
{
    const suite = fromMarkdown(filename);

    return new Promise(function (resolve, reject)
    {
        program(Run.init(suite), Run.update, function (run, event)
        {
            console.log("running...");

            if (run.results.has(suite))
                console.log("ALL DONE");
        })(Map());
    });

}

Run.init = function (suite)
{
    const root = Path({ node: suite, index: 0 });
    const workers = Range(0, 10).map(() => process);
    const requests = getPostOrderLeaves(root);

    return Run({ queue: Queue.init({ workers, requests }) });
}

Run.update = function (run, event)
{
    return (function (run, event)
    {
        if (event instanceof Queue.Response)
        {
            const { request, push } = event;
            const path = request.arguments.get(0);
            const result = event.value;
            const results = run.results.set(path.node, result);
            const requests = getUnblockedRequests(path, results);
            const queue = requests.size <= 0 ?
                run.queue :
                Queue.update(run.queue, Queue.Enqueue({ requests, push }));

            return run
                .set("results", results)
                .set("queue", queue);
        }

        if (event instanceof Queue.Started)
            return run.update("starts", starts =>
                event.requests.reduce((starts, { arguments }) =>
                    starts.set(arguments.get(0).node, Date.now()), starts));

        return run;
    })(run.set("queue", Queue.update(run.queue, event)), event);
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

//module.exports("/Users/tolmasky/Development/tonic/app/__tests__/notebook-cloning.test.md");
//module.exports("/Users/tolmasky/Development/tonic/app/__tests__/notebook-editing.test.md");

function getUnblockedRequests(path, results)
{
    const { parent, index } = path;

    if (!parent)
        return List();

    const suite = parent.node;
    const isSerial = suite.metadata.schedule === Suite.Serial;
    const siblings = suite.children;
    const siblingsComplete = isSerial ? 
        index === siblings.size - 1 :
        siblings.every(sibling => results.has(sibling));

    if (siblingsComplete)
        return parent ?
            List.of(Queue.Request({ arguments: List.of(parent, results) })) :
            List();

    if (!isSerial)
        return List();

    return getPostOrderLeaves(
        Path({ index: index + 1, parent, node: siblings.get(index + 1) }),
        results);
}

function getPostOrderLeaves(path, results)
{
    const { node } = path;

    if (node instanceof Test)
        return List.of(Queue.Request({ arguments: List.of(path, results) }));

    const { children } = node;

    if (node.children.size <= 0)
        return List();

    if (node.metadata.schedule === Suite.Serial)
        return getPostOrderLeaves(
            Path({ parent: path, node: node.children.get(0), index: 0 }),
            results);

    return node.children.flatMap((node, index) =>
        getPostOrderLeaves(Path({ parent: path, node, index })),
        results);
}

async function process({ node }, states)
{
    return node instanceof Suite ? 
        process.suite(node, states) :
        await process.test(node);
}

process.test = async function (test)
{
    console.log("RUNNING " + test.metadata.title);
    return Success();
/*
    const duration = (start => () => 
        (Date.now() - start))(Date.now());

    try
    {
        for (const block of test.blocks)
            eval(block);
    }
    catch (reason)
    {
        return Failure({ duration: duration(), reason });
    }

    return Success({ duration: duration() });*/
}

process.suite = function (suite, states)
{
    console.log("ENTERING " + suite.metadata.title);
    return Success();
    const children = suite.children
        .map(child => states.get(child));
    const failures = children
        .filter(state => state instanceof Failure)
    const duration = children.reduce(
        (duration, state) => duration + state.duration, 0);

    return failures.size > 0 ?
        Failure({ duration, reason: failures }) :
        Success({ duration });
}
