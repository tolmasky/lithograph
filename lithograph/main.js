const { Repeat, Range, List, Map } = require("immutable");
const { Cause, field, event, update, IO } = require("@cause/cause");
const Pool = require("@cause/pool");
const Fork = require("@cause/fork");
const FileProcess = require("./file-process");
const FileExecution = require("./file-execution");
const Browser = require("./browser");

const Node = require("@lithograph/ast");
const Result = require("@lithograph/status/result");


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

    [event._on(Result.Suite)] (main, result)
    {
        const [,, index] = result.fromKeyPath;
        const [updated, events] = update.in(
            main.update("results", results => results.push(result)),
            "fileProcessPool",
            Pool.Release({ indexes: [index] }));
        const { results } = updated;
        const finished = results.size === main.paths.size;

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
    console.log("RETAINED FILE PROCESS: " + index + " " + Date.now());
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

    [event.on (Browser.DidReset)]: (main, { fromKeyPath: [,,index] }) =>
        update.in(main, "browserPool", Pool.Release({ indexes: [index] })),

    [event.on (Pool.Retained) .from `browserPool`](main, event)
    {
        const { request, index } = event;
        const [fromFileProcess, id] = request;
        const { endpoint } = main.browserPool.items.get(index);

        return update.in(
            main,
            ["fileProcessPool", "items", fromFileProcess],
            FileProcess.EndpointResponse({ id, endpoint }));
    }
});

function toRootSuite({ title, children })
{
    const empty = Node.Source.Position({ line:-1, column:-1 });
    const source = Node.Source({ filename: "", start: empty, end: empty });
    const block = Node.Block({ id: -1, title, depth: -1, source });

    return Node.Suite({ block, children, mode: Node.Suite.Mode.Concurrent });
}


