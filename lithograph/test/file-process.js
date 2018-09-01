const { Map } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const FileExecution = require("./file-execution");


const FileProcess = Cause("FileProcess",
{
    // FIXME: Make this not necessary...
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

function generateGetEnvironment(push)
{
    const template = { getBrowser, getBrowserContext };
    const getEnvironment = () => Map(Object.keys(template)
        .map(key => [key, (...args) => template[key](...args)]))
        .toObject();
    const event = FileProcess.GeneratedGetEnvironment({ getEnvironment });

    push(event);

    async function getBrowserContext()
    {
        return await (await getBrowser(push))
            .createIncognitoBrowserContext();
    }

    async function getBrowser()
    {
        const browserWSEndpoint = await new Promise((resolve, reject) =>
            push(FileProcess.GetBrowserCalled({ resolve, reject })));

        return await require("puppeteer").connect({ browserWSEndpoint });
    }
}
