const { Range, List } = require("immutable");
const { Cause, field, event, update, IO } = require("cause");
const Pool = require("@cause/pool");
const Process = require("@cause/process");
const FileProcess = require("./file-process");

setTimeout(function() { }, 50000);
module.exports = function main(paths, options)
{
    const requires = JSON.stringify(options.requires || []);

    return IO.toPromise(Main.create({ ...options, paths, requires }));
}

const Main = Cause("Main",
{
    [field `paths`]: -1,
    [field `fileProcessPool`]: -1,
    [field `fileProcesses`]: -1,

    init({ paths, concurrency })
    {
        const fileProcessPool = Pool.create({ count: concurrency });
        const fileProcesses = Range(0, concurrency)
            .map(index => List.of(FileProcess.fork(), false))
            .toList();

        return { fileProcessPool, fileProcesses, paths };
    },

    [event.on (FileProcess.Ready)](main, event, fromKeyPath)
    {
        const index = fromKeyPath.next.data;
        const updated = main.setIn(["fileProcesses", index, 1], true);
        const ready = updated.fileProcesses.every(([_, ready]) => ready);

        return ready ?
            update.in(updated, "fileProcessPool",
                Pool.Enqueue({ requests: main.paths })) :
            updated;
    },

    [event.on (Process.Started)]: main =>
        main.fileProcesses.every(([_, ready]) => ready) ?
            update.in(main, "fileProcessPool",
                Pool.Enqueue({ requests: main.paths })) :
            main,

    [event.on (Pool.Retained)]: (main, { request: path, index }) =>
        update.in(main, ["fileProcesses", index, 0],
            Process.Message({ event: FileProcess.Execute({ path }) })),

    [event.on (Cause.Start)]: main =>
        update.in.reduce(main,
            main.fileProcesses.map((_, index) =>
                [["fileProcesses", index, 0], Cause.Start()])),
/*
    [event.on (Pool.Released)]: (main, { indexes })
    
    [event.on (Process.Message())]: (main)

    [event.on (Pool.Allotted)]: (main, { allotments }) =>
        update.in.all(alottment.map(({ index, request }) =>
            [["fileProcess", index], Process.Message({ path: request })],
            main),
        
        
        fileExecution.set("running", fileExecution.running
            .merge(Map(allotments.map(({ request: path, key }) =>
                [path.data.id, IO.fromAsync(() => testRun({ path, key })) ])))),
        request: path, index
        update.in(main, ["fileProcesses", index], Process.Message({ path })),

    [event.on (Cause.Start)]: main =>
        update.in(main, ["fileProcessPool"], Pool.Enqueue({ requests: main.paths }))*/
});
