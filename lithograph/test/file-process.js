const { Cause, IO, field, event, update } = require("cause");
const FileExecution = require("./file-execution");


const FileProcess = Cause("FileProcess",
{
    [field `fileExecution`]: -1,

    [event.in `Execute`]: { path:-1 },
    [event.on `Execute`]: (fileProcess, { path }) =>
        update.in(
            fileProcess.set("fileExecution",
                FileExecution.create({ path })),
            "fileExecution",
            Cause.Start()),

    [event.on (Cause.Start)]: event.ignore,

    [event.out `Executed`]: { path: -1 },
    [event.on (FileExecution.Finished)]: fileProcess =>
        (path => [fileProcess, [FileProcess.Executed({ path })]])
        (fileProcess.fileExecution.path)
});

module.exports = FileProcess;
