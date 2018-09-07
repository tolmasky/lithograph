require("source-map-support").install({ hookRequire: true });

const { List, Map } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const FileExecution = require("./file-execution");
const generateGetEnvironment = require("./generate-get-environment");


const FileProcess = Cause("FileProcess",
{
    // FIXME: Make this not necessary...
    // Instead, some sort of compound Ready would be nice, since this
    // should really be in an IO.
    init: ({ requires }) =>
        (requires.map(path => require(path)), { }),

    [event.on (Cause.Start)]: event.ignore,

    [field `ready`]: false,
    [field `fileExecution`]: -1,
    [field `generateGetEnvironment`]: IO.start(generateGetEnvironment),

    [event.in `Execute`]: { path:-1 },
    [event.on `Execute`]: (fileProcess, { path }) =>
    {
        const environment = fileProcess.getEnvironment();
        const fileExecution =
            FileExecution.create({ path, environment });

        return update.in(
            fileProcess.set("fileExecution", fileExecution),
            "fileExecution",
            Cause.Start());
    },

    [event.out `Executed`]: { path: -1 },
    [event.on (FileExecution.Finished)]: fileProcess =>
        (path => [fileProcess, [FileProcess.Executed({ path })]])
        (fileProcess.fileExecution.path),

    //     
    [field `getEnvironment`]: -1,

    [event.in `GeneratedGetEnvironment`]: { getEnvironment: -1 },
    [event.on `GeneratedGetEnvironment`]: (fileProcess, { getEnvironment }) =>
    [
        fileProcess
            .set("getEnvironment", getEnvironment)
            .set("ready", true),
        [Cause.Ready()]
    ],

    // 
    [field `getBrowserCallbacks`]: Map({ id: 0 }),

    [event.in `GetBrowserCalled`]: { resolve: -1, reject: -1 },
    [event.on `GetBrowserCalled`](fileProcess, event)
    {
        const id = fileProcess.getBrowserCallbacks.get("id");
        const outFileProcess = fileProcess.set("getBrowserCallbacks",
            fileProcess
                .getBrowserCallbacks
                .concat([["id", id + 1], [id, event]]));

        return [outFileProcess, [FileProcess.EndpointRequest({ id })]];
    },

    [event.out `EndpointRequest`]: { id: -1 },
    [event.in `EndpointResponse`]: { id: -1, endpoint: -1 },
    [event.on `EndpointResponse`]: (fileProcess, { id, endpoint }) =>
    {
        // IO!
        fileProcess.getBrowserCallbacks.get(id).resolve(endpoint);
        return fileProcess;
    }
});

module.exports = FileProcess;
