const { Repeat, List } = require("immutable");
const { Cause, field, event, update, IO } = require("@cause/cause");
const Pool = require("@cause/pool");
const Fork = require("@cause/fork");
const FileProcess = require("./file-process");
const FileExecution = require("./file-execution");
const Browser = require("./browser");

const { Suite, Block } = require("@lithograph/ast");
const Result = require("@lithograph/status/result");
const Log = require("./log");


module.exports = async function main(paths, options)
{
    const promise =
        IO.toPromise(Main.create({ ...options, paths }));

    return await promise;
}

const Main = Cause("Main",
{
    [field `title`]: -1,
    [field `paths`]: -1,
    [field `results`]: List(),

    [field `browserPool`]: -1,
    [field `fileProcessPool`]: -1,

    init({ paths: iterable, title, concurrency, requires, headless })
    {
        const paths = List(iterable);

        const browserPool = Pool.create(
            { items: Repeat(Browser.create({ headless }), concurrency) });
        const fork = Fork.create({ type: FileProcess, fields: { requires } });
        const fileProcessPool = Pool.create(
            { items: Repeat(fork, concurrency) });

        return { fileProcessPool, browserPool, paths, title };
    },

    [event._on(Log)]: (main, log) => (console.log(log.message), [main, []]),

    [event._on(Result.Suite)] (main, result)
    {
        const [,, index] = result.fromKeyPath;
        const [updated, events] = update.in(
            main.update("results", results => results.push(result)),
            "fileProcessPool",
            Pool.Release({ indexes: [index] }));
        const { results } = updated;
        const finished = results.size === main.paths.size;
console.log("FINISHED " + result.suite.block.title + " " + (main.paths.size - results.size));
        if (!finished)
            return [updated, events];

        const children = results.map(result => result.suite);
        const suite = toRootSuite({ title: main.title, children });
        const value = Result.Suite.fromChildren(suite, results);

        return [updated, [...events, Cause.Finished({ value })]];
    },

    [event.on (Pool.Retained) .from `fileProcessPool`](main, event)
    {
        const { request: path, index } = event;
console.log("STARTING " + path);
        return update.in(
            main,
            ["fileProcessPool", "items", index],
            FileProcess.Execute({ path }));
    },

    [event.on (Cause.Start)]: main =>
        update.in(main,
            "fileProcessPool",
            Pool.Enqueue({ requests: main.paths })),


    [event.on (FileProcess.EndpointRequest)](main, { id, fromKeyPath })
    {
        const [,, fromFileProcess] = fromKeyPath;
        const requests = [List.of(fromFileProcess, id)];

        return update.in(main, "browserPool", Pool.Enqueue({ requests }));
    },

    [event.on (FileProcess.EndpointRelease)](main, { ids, fromKeyPath })
    {
        const [,, fromFileProcess] = fromKeyPath;
        const requests = ids.map(id => List.of(fromFileProcess, id));
        const occupied = main.browserPool.occupied;
        const indexes = requests
            .map(request => occupied.keyOf(request));

        return update.in.reduce(
            main,
            indexes.map(index => [["browserPool", "items", index], Browser.Reset()]));
    },

    [event.on (Browser.DidReset)]: (main, { fromKeyPath: [,,index] }) => {
//        console.log("(R) WILL NOW HAVE " + (main.browserPool.free.size + 1));
//        console.log("    " + main.browserPool.items);
        return update.in(main, "browserPool", Pool.Release({ indexes: [index] }));
},
    [event.on (Pool.Retained) .from `browserPool`](main, event)
    {
        const { request, index } = event;
        const [fromFileProcess, id] = request;
        const { endpoint } = main.browserPool.items.get(index);
//console.log("(A) WILL NOW HAVE " + main.browserPool.free.size);
        return update.in(
            main,
            ["fileProcessPool", "items", fromFileProcess],
            FileProcess.EndpointResponse({ id, endpoint }));
    }
});

function toRootSuite({ title, children })
{
    const block = Block({ id: -1, title, depth: -1 });

    return Suite({ block, children, mode: Suite.Mode.Concurrent });
}

module.exports.Log = Log;



