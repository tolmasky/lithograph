require("source-map-support").install({ hookRequire: true });

const { declare, data } = require("@algebraic/type");
const LitFile = require("./lit-file");
const { Cause, IO, field, event, update } = require("@cause/cause");
const FileExecution = require("./file-execution");
const GarbageCollector = require("./garbage-collector");
const Result = require("@lithograph/status/result");
const Log = require("./log");

const FIXME_ANY = declare({ is: () => true, serialize:[()=>0,true],deserialize:()=>undefined });
const Execute = data `Execute` ( file => LitFile, fromKeyPath => [FIXME_ANY, null] );


const FileProcess = Cause("FileProcess",
{
    // FIXME: Make this not necessary...
    // Instead, some sort of compound Ready would be nice, since this
    // should really be in an IO.
    init: ({ requires, workspace }) =>
        (requires.map(path => require(path)), { workspace }),

    [event.on (Cause.Start)]: event.ignore,

    [field `workspace`]: -1,
    [field `fileExecution`]: -1,

    [event._on(Log)]: (fileProcess, log) =>
        [fileProcess, [log.update("fromKeyPath", () => undefined)]],

    [event._on (Execute)]: (fileProcess, { file }) =>
    {
        const fileExecution = FileExecution.create(
        {
            file,
            workspace: fileProcess.workspace
        });

        return update.in(
            fileProcess.set("fileExecution", fileExecution),
            "fileExecution",
            Cause.Start());
    },

    [event.out `Executed`]: { result:-1 },
    [event._on (Result)]: (fileProcess, result) =>
        [fileProcess, [result.update("fromKeyPath", () => undefined)]],

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

Execute.prototype.update = function (key, f)
{
    return Execute({ ...this, [key]: f(this[key]) });
}

FileProcess.Execute = Execute;

module.exports = FileProcess;
