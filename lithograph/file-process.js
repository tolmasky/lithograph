require("source-map-support").install({ hookRequire: true });

const { List, Map } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const FileExecution = require("./file-execution");
const GarbageCollector = require("./garbage-collector");


const FileProcess = Cause("FileProcess",
{
    // FIXME: Make this not necessary...
    // Instead, some sort of compound Ready would be nice, since this
    // should really be in an IO.
    init: ({ requires }) =>
        (requires.map(path => require(path)), { }),

    [event.on (Cause.Start)]: event.ignore,

    [field `fileExecution`]: -1,

    [event.in `Execute`]: { path:-1 },
    [event.on `Execute`]: (fileProcess, { path }) =>
    {console.log("EXECUTING!!!! " + Date.now());
        const fileExecution = FileExecution.create({ path });

        return update.in(
            fileProcess.set("fileExecution", fileExecution),
            "fileExecution",
            Cause.Start());
    },

    [event.out `Executed`]: { path: -1 },
    [event.on (FileExecution.Finished)]: fileProcess =>
        (path => [fileProcess, [FileProcess.Executed({ path })]])
        (fileProcess.fileExecution.path),

    [event.out `EndpointRequest`]: { id: -1 },
    [event.on (GarbageCollector.Allocate)]: (fileProcess, { id }) =>
        [fileProcess, [FileProcess.EndpointRequest({ id })]],

    [event.out `EndpointRelease`]: { ids: -1 },
    [event.on (GarbageCollector.Deallocate)]: (fileProcess, { ids }) =>
        [fileProcess, [FileProcess.EndpointRelease({ ids })]],

    [event.in `EndpointResponse`]: { id: -1, endpoint: -1 },
    [event.on `EndpointResponse`]: (fileProcess, { id, endpoint }) =>
        update.in(fileProcess,
            ["fileExecution", "garbageCollector"],
            GarbageCollector.Allocated({ id, resource: endpoint }))
});

module.exports = FileProcess;
