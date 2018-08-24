const { Cause, IO, field, event, update } = require("cause");
const Parent = require("@cause/process/parent");
const FileExecution = require("./file-execution");
setTimeout(function()
{
}, 50000);

const FileProcess = Cause("FileProcess",
{
    [field `parent`]: Parent.create({ fromMessageToEvent }),
    [field `fileExecution`]: -1,

    [event.on (Parent.Ready)]: (fileProcess, { path }) =>
        update.in_(["parent"],
            [Parent.Message({ data: { name: "ready" } })],
            fileProcess),

    [event.in `Execute`]: { path:-1 },
    [event.on `Execute`]: (fileProcess, { path }) => update.in_(
        "fileExecution",
        Cause.Start(),
        fileProcess.set("fileExecution", FileExecution.create({ path }))),

    [event.on (Cause.Start)]: event.ignore,

    [event.on (FileExecution.Finished)]: (fileProcess, event) =>
    {
        console.log("FINISHED!");
        return fileProcess;
    }
});

function fromMessageToEvent(message)
{console.log("YES!");
    if (message.name === "execute")
        return FileProcess.Execute({ path: message.path });
}

IO.toPromise(FileProcess.create({ }));
