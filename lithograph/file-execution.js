const { Record, List, Map, Range, Set } = require("immutable");
const { Cause, IO, field, event, update } = require("@cause/cause");
const { Test, NodePath, Suite, fromMarkdown } = require("@lithograph/ast");
const Status = require("@lithograph/status");
const Pool = require("@cause/pool");
const compile = require("./compile");
const GarbageCollector = require("./garbage-collector");
const toEnvironment = require("./file-execution/to-environment");
const Result = Record({ statuses:Map(), root:-1 }, "FileExecution.Result");

require("./magic-ws-puppeteer");
require("./test-worker/static");


const FileExecution = Cause("FileExecution",
{
    [field `path`]: -1,
    [field `root`]: -1,
    [field `pool`]: Pool.create({ count: 100 }),
    [field `running`]: Map(),
    [field `statuses`]: 0,
    [field `functions`]: Map(),
    [field `garbageCollector`]: -1,
    [field `incomplete`]: Map(),//number, Status.Incomplete),

    init: ({ path }) =>
    {
        const node = fromMarkdown(path);
        const root = NodePath.Suite.Root({ suite: node });
        const garbageCollector = GarbageCollector.create({ node });

        return { path, root, garbageCollector };
    },

    [event.on (Cause.Ready) .from `garbageCollector`](fileExecution)
    {
        const { root, garbageCollector } = fileExecution;
        const { unblocked, incomplete } = Status.findUnblockedDescendentPaths(root);
        const { allocate } = garbageCollector;
        const outFileExecution = fileExecution
            .set("functions", compile(toEnvironment(allocate), root))
            .set("incomplete", incomplete);

        return update.in(
            outFileExecution,
            ["pool"],
            Pool.Enqueue({ requests: unblocked }));
    },

    [event.on (Cause.Start)]: event.ignore,/*fileExecution =>
        !fileExecution.browserEndpoints.ready ?
            fileExecution :
            update.in(fileExecution, ["pool"], Pool.Enqueue(
                { requests: getPostOrderLeaves(fileExecution.root) })),*/

    [event.on (Pool.Retained)]: (fileExecution, { index, request }) =>
    {console.log("here?");
        const testPath = request;
        const functions = fileExecution.functions;
        const incomplete = Status.updateTestPathToRunning(
            testPath,
            fileExecution.incomplete,
            Date.now());

        return fileExecution
            .set("incomplete", incomplete)
            .setIn(["running", testPath.test.block.id],
                IO.fromAsync(() => testRun({ functions, testPath, index })));
    },

    // FIXME: Shouldn't need to do this with keyPath. Right?
    [event.on (GarbageCollector.Allocate)]: (fileExecution, event) => {
    //console.log(event, event.update("fromKeyPath", fromKeyPath => fromKeyPath.next));
        return [fileExecution, [event.update("fromKeyPath", fromKeyPath => fromKeyPath.next)]]
    },

    // FIXME: Shouldn't need to do this with keyPath. Right?
    [event.on (GarbageCollector.Deallocate)]: (fileExecution, event) => {
    //console.log(event, event.update("fromKeyPath", fromKeyPath => fromKeyPath.next));
        return [fileExecution, [event.update("fromKeyPath", fromKeyPath => fromKeyPath.next)]]
    },

    [event.out `Finished`]: { result: -1 },

    [event.in `TestSucceeded`]: { testPath:-1, index:-1, end:-1 },
    [event.on `TestSucceeded`]: testFinished,

    [event.in `TestFailed`]: { testPath:-1, index:-1, end:-1, reason:-1 },
    [event.on `TestFailed`]: testFinished
});

FileExecution.Result = Result;

Result.serialize = function serializeResult(result)
{
    const root = Suite.serialize(result.root);
    const statuses = Status.serialize.map(result.statuses);

    return { statuses, root };
}

Result.deserialize = function deserializeResult(serialized)
{
    const root = Suite.deserialize(serialized.root);
    const statuses = Status.deserialize.map(serialized.statuses);

    return Result({ statuses, root });
}

function testFinished(fileExecution, event)
{console.log("OK HERE");
    const { testPath, index, end } = event;
    const failure = event instanceof FileExecution.TestFailed;
    //[statuses, requests, scopes, finished]
    console.log(fileExecution.incomplete);
    const incomplete =
        Status.updateTestPathToSuccess(testPath, fileExecution.incomplete, Date.now());
//        (failure ? Status.updateTestPathToFailure : Status.updateTestPathToSuccess)
//        (fileExecution.statuses, path, end, failure && event.reason);
    const outFileExecution = fileExecution
        .set("statuses", statuses)
        .removeIn(["running", path.node.metadata.id]);

    const [updated, events] = update.in.reduce(outFileExecution,
    [
        ["garbageCollector", GarbageCollector.ScopesExited({ scopes })],
        ["pool", Pool.Release({ indexes: [index] })]
    ]);

    // If we exited the root scope, then we're done.
    if (finished)
    {
        const root = fileExecution.root.node;
        console.log("DONE " + fileExecution.root.node.metadata.id + " " + scopes);
        const result = FileExecution.Result
            .serialize(FileExecution.Result({ statuses, root }));

        return [updated, [FileExecution.Finished({ result }), ...events]];
    }

    const [enqueued, fromEnqueueEvents] =
        update.in(updated, "pool", Pool.Enqueue({ requests }));

    return [enqueued, [...events, ...fromEnqueueEvents]];
}

module.exports = FileExecution;

async function testRun({ functions, testPath, index })
{
    const start = Date.now();
    const { id, title } = testPath.test.block;
    const f = functions.get(id);

    console.log("RUN " + testPath.test.block.id + " -> " + title + " " + Date.now());

    const [failed, reason] = await f()
        .then(() => [false])
        .catch(reason => [true, reason]);
    const end = Date.now();

    console.log("finished " + id + " -> " + title + " " + !failed);

    return failed ? 
        FileExecution.TestFailed({ testPath, index, end, reason }) :
        FileExecution.TestSucceeded({ testPath, index, end });
}

function toObject(node, reports)
{
    const { title, disabled } = node.metadata;
    const isTest = node instanceof Test
    const type = isTest ? "test" : "suite";
    const report = reports.get(node.metadata.id);
    const outcome = report.outcome instanceof Report.Success ?
        { type: "success" } :
        { type: "failure", reason: toErrorObject(report.outcome.reason) };
    const reportObject = { duration: report.duration, outcome };
    const common = { title, disabled, type, report: reportObject };
    const children = !isTest &&
        node.children.map(node => toObject(node, reports));

    return { ...common, ...(children && { children }) };
}

function toErrorObject(error)
{
    return { message: error.message, stack: error.stack };
}
