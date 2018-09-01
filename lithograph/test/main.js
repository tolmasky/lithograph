const { Repeat, Range, List, Map } = require("immutable");
const { Cause, field, event, update, IO } = require("cause");
const Pool = require("@cause/pool");
const Fork = require("@cause/fork");
const FileProcess = require("./file-process");
const FileExecution = require("./file-execution");
const Browser = require("./browser");


module.exports = async function main(paths, options)
{
    const requires = JSON.stringify(options.requires || []);
    const promise =
        IO.toPromise(Main.create({ ...options, paths, requires }));

    await promise;

    console.log("NOW DONE");
}

const Main = Cause("Main",
{
    [field `paths`]: -1,
    [field `reports`]: Map(),

    [field `browserPool`]: -1,
    [field `fileProcessPool`]: -1,

    init({ paths: iterable, concurrency })
    {
        const paths = List(iterable);

        const browserPool = Pool.create(
            { items: Repeat(Browser(), concurrency) });
        const fileProcessPool = Pool.create(
            { items: Repeat(Fork(FileProcess), concurrency) });

        return { fileProcessPool, browserPool, paths };
    },

    [event.on (FileProcess.Executed)](main, event)
    {
        const [,, index] = event.fromKeyPath;
        const reported = main.setIn(["reports", event.path], true);
        const finished = reported.reports.size === reported.paths.size;
        const [updated, events] = update.in(
            reported,
            "fileProcessPool",
            Pool.Release({ indexes: [index] }));

        return [updated, [...events, finished && Cause.Finished()]];
    },

    [event.on (Pool.Retained) .from `fileProcessPool`](main, event)
    {
        const { request: path, index } = event;
    console.log("RETAINED");
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
        const requests = [{ id, fromFileProcess }];
console.log("REQUEST", fromKeyPath);
        return update.in(main, "browserPool", Pool.Enqueue({ requests }));
    },

    [event.on (Pool.Retained) .from `browserPool`](main, event)
    {console.log("BROWSER!!!");
        const { request, index } = event;
        const { id, fromFileProcess } = request;
        const { endpoint } = main.browserPool.items.get(index);

        return update.in(
            main,
            ["fileProcessPool", "items", fromFileProcess],
            FileProcess.EndpointResponse({ id, endpoint }));
    }
/*
    [event.on (Pool.Retained) .from `browserPool`](main, { request, index })
    {
        const { endpoint } = main.browserPool.items.get(index);
        const { key, id } = request;

        return update.in(main,
            ["fileProcesses", key],
            FileExecution.BrowserResponse({ id, endpoint }));
    }*/
});


