const { is } = require("@algebraic/type");
const { Map } = require("immutable");
const { Cause, IO, field, event, update } = require("@cause/cause");
const { Test, Suite, fromMarkdown } = require("@lithograph/ast");
const { Status, Result } = require("@lithograph/status");
const { Reason } = Result.Failure;

const Pool = require("@cause/pool");
const compile = require("./compile");
const GarbageCollector = require("./garbage-collector");
const toEnvironment = require("./file-execution/to-environment");


require("./magic-ws-puppeteer");
require("./test-worker/static");


const FileExecution = Cause("FileExecution",
{
    [field `root`]: -1,
    [field `pool`]: Pool.create({ count: 100 }),
    [field `running`]: Map(),
    [field `functions`]: Map(),
    [field `garbageCollector`]: -1,
    [field `status`]: -1,

    init: ({ path }) =>
    {
        const root = fromMarkdown(path);
        const garbageCollector = GarbageCollector.create({ node: root });

        return { root, garbageCollector };
    },

    [event.on (Cause.Ready) .from `garbageCollector`](fileExecution)
    {
        const { root, garbageCollector } = fileExecution;
        const { unblocked, status } =
            Status.initialStatusOfNode(fileExecution.root);
        const { allocate } = garbageCollector;
        const outFileExecution = fileExecution
            .set("functions", compile(toEnvironment(allocate), root))
            .set("status", status);

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

    [event.on (Pool.Retained)]: (fileExecution, { index, request: testPath }) =>
    {
        const functions = fileExecution.functions;
        const { status, test } = Status.updateTestPathToRunning(
            fileExecution.status,
            testPath,
            Date.now());

        return fileExecution
            .set("status", status)
            .setIn(["running", test.block.id],
                IO.fromAsync(() => testRun({ functions, test, testPath, index })));
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

    [event.in `Report`]: { testPath:-1, test:-1, index: -1, report:-1 },
    [event.on `Report`]: testFinished
});

function testFinished(fileExecution, event)
{
    const { testPath, test, index, report } = event;
    const { status } = fileExecution;
    const { status: updatedStatus, unblocked, scopes } =
        Status.updateTestPathWithReport(status, testPath, report);
    const withUpdatedStatus = fileExecution
        .set("status", updatedStatus)
        .removeIn(["running", test.block.id]);
    const [withUpdatedHelpers, events] = update.in.reduce(withUpdatedStatus,
    [
        ["garbageCollector", GarbageCollector.ScopesExited({ scopes })],
        ["pool", Pool.Release({ indexes: [index] })]
    ]);
    const finished = is(Status.Result, withUpdatedHelpers.status);

    // If we exited the root scope, then we're done.
    if (finished)
        return [withUpdatedHelpers, [...events, withUpdatedHelpers.status]];

    const [enqueued, fromEnqueueEvents] =
        update.in(withUpdatedHelpers, "pool", Pool.Enqueue({ requests: unblocked }));

    return [enqueued, [...events, ...fromEnqueueEvents]];
}

module.exports = FileExecution;

async function testRun({ functions, test, testPath, index })
{
    const start = Date.now();
    const { id, title } = test.block;
    const f = functions.get(id);

    console.log("RUN " + test.block.id + " -> " + title + " " + Date.now());

    const [succeeded, error] = await f()
        .then(() => [true])
        .catch(error => [false, error]);
    const end = Date.now();
    const report = succeeded ?
        Status.Report.Success({ end }) :
        Status.Report.Failure(
        {
            end,
            reason: error instanceof Error ?
                Reason.Error(error) :
                Reason.Value({ stringified: JSON.stringified(error) })
        });

    console.log("finished " + id + " -> " + title + " " + succeeded);

    return FileExecution.Report({ testPath, test, index, end, report });
}
