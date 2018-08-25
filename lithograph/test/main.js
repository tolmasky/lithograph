const { Range, List, Map } = require("immutable");
const { Cause, field, event, update, IO } = require("cause");
const Pool = require("@cause/pool");
const Fork = require("@cause/fork");
const FileProcess = require("./file-process");


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
    [field `fileProcessPool`]: -1,
    [field `fileProcesses`]: -1,

    init({ paths: iterable, concurrency })
    {
        const fileProcessPool = Pool.create({ count: concurrency });
        const fileProcesses = Range(0, concurrency)
            .map(() => Fork(FileProcess))
            .toList();
        const paths = List(iterable);

        return { fileProcessPool, fileProcesses, paths };
    },

    [event.on (FileProcess.Executed)](main, event, fromKeyPath)
    {
        const index = fromKeyPath.next.data;
        const reported = main.setIn(["reports", event.path], true);
        const finished = reported.reports.size === reported.paths.size;
        const [updated, events] = update.in(
            reported,
            "fileProcessPool",
            Pool.Release({ indexes: [index] }));

        return [updated, [...events, finished && Cause.Finished()]];
    },

    [event.on (Pool.Retained)]: (main, { request: path, index }) =>
        update.in(
            main,
            ["fileProcesses", index],
            FileProcess.Execute({ path })),

    [event.on (Cause.Start)]: main =>
        update.in.reduce(main,
        [
            ...main.fileProcesses.map((_, index) =>
                [["fileProcesses", index], Cause.Start()]),
            ["fileProcessPool", Pool.Enqueue({ requests: main.paths })]
        ])
});
