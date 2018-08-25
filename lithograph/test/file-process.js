const { Cause, IO, field, event, update } = require("cause");
const Process = require("@cause/process");
const Parent = require("@cause/process/parent");
const FileExecution = require("./file-execution");
console.log("IN SEPARATE PROCESS");
const FileProcess = Cause("FileProcess",
{
    [field `parent`]: Parent.create(),
    [field `fileExecution`]: -1,

    [event.out `Ready`]: { },
    [event.on (Parent.Ready)]: (fileProcess, { path }) =>
        update.in(fileProcess,
            "parent",
            Parent.Message({ event: FileProcess.Ready() })),

    [event.in `Execute`]: { path:-1 },
    [event.on `Execute`]: (fileProcess, { path }) =>
        update.in(
            fileProcess.set("fileExecution",
                FileExecution.create({ path })),
            "fileExecution",
            Cause.Start()),

    [event.on (Cause.Start)]: event.ignore,

    [event.out `Executed`]: { },
    [event.on (FileExecution.Finished)]: fileProcess =>
        [fileProcess, [FileProcess.Executed()]]
});

FileProcess.fork = () => Process.node({ path: __filename });

module.exports = FileProcess;

if (require.main === module)
    IO.toPromise(FileProcess.create({ }));
