const { is } = require("@algebraic/type");
const { Map } = require("immutable");
const { Cause, IO, field, event, update } = require("@cause/cause");
const { Test, Suite } = require("@lithograph/ast");
const { Status, Result } = require("@lithograph/status");
const { Reason } = Result.Failure;
const Log = require("./log");

const Pool = require("@cause/pool");
const compile = require("@lithograph/compile");
const GarbageCollector = require("./garbage-collector");
const toEnvironment = require("./file-execution/to-environment");


require("./magic-ws-puppeteer");
require("./test-worker/static");


const FileExecution = Cause("FileExecution",
{
    [field `filename`]: -1,
    [field `suite`]: -1,
    [field `status`]: -1,

    [field `running`]: Map(),
    [field `functions`]: Map(),
    [field `garbageCollector`]: -1,

    [field `pool`]: Pool.create({ count: 100 }),

    init: ({ path: filename }) =>
    {
        const suite = Suite.fromMarkdown(filename);
        const garbageCollector = GarbageCollector.create({ });

        return { suite, garbageCollector, filename };
    },

    [event.on (Cause.Ready) .from `garbageCollector`](fileExecution)
    {
        const { suite, filename, garbageCollector } = fileExecution;
        const { unblocked, status } = Status.initialStatusOfNode(suite);
        const { allocate } = garbageCollector;
        const { functions, findShallowestScope } =
            compile(toEnvironment(type =>
                allocate(findShallowestScope(), type)),
            suite, filename);

        const outFileExecution = fileExecution
            .set("functions", functions)
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
        return [fileExecution, [event]]
    },

    // FIXME: Shouldn't need to do this with keyPath. Right?
    [event.on (GarbageCollector.Deallocate)]: (fileExecution, event) => {
    //console.log(event, event.update("fromKeyPath", fromKeyPath => fromKeyPath.next));
        return [fileExecution, [event]]
    },

    [event.in `Report`]: { testPath:-1, test:-1, index: -1, report:-1, start:-1 },
    [event.on `Report`]: testFinished
});

function testFinished(fileExecution, event)
{
    const { testPath, test, index, report, start  } = event;
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

    // We should just get the test result back from update...
    const duration = report.end - start;
    const message = is(Status.Report.Success, report) ?
        `✓ SUCCESS: ${test.block.title} (${duration}ms)` :
        `✕ FAILURE: ${test.block.title} (${duration}ms)\n` +
            (is(Reason.Error, report.reason) ?
                report.reason.stack :
                report.reason.stringified);
    const withLog = [...events, Log({ message })];

    // If we exited the root scope, then we're done.
    if (is(Result, withUpdatedHelpers.status))
        return [withUpdatedHelpers, [...withLog, withUpdatedHelpers.status]];

    const [enqueued, fromEnqueueEvents] =
        update.in(withUpdatedHelpers, "pool", Pool.Enqueue({ requests: unblocked }));

    return [enqueued, [...withLog, ...fromEnqueueEvents]];
}

module.exports = FileExecution;

async function testRun({ functions, test, testPath, index })
{
    const start = Date.now();
    const { id, title } = test.block;
    const retriesMatch = title.match(/^ATTEMPTS=(\d+).*/);
    const maxAttempts = retriesMatch ? parseInt(retriesMatch[1]) : 1;
    const f = functions.get(id);
//console.log("GETTING " + id + " " + f+"");
    // FIXME: Would be nice to use Log() here...
    console.log("  STARTED: " + title);
//console.log("CALLING " + f);
    var attempt = 1;
    while (true)
    {
        var [succeeded, error] = await f()
            .then(() => [true])
            .catch(error => [false, error]);

        attempt++;
        if (succeeded || attempt > maxAttempts)
            break;

        console.log(`  RETRY(${attempt}/${maxAttempts}): ${title}`);
    }
    const end = Date.now();
    const report = succeeded ?
        Status.Report.Success({ end }) :
        Status.Report.Failure(
        {
            end,
            reason: error instanceof Error ?
                Reason.Error(error) :
                Reason.Value({ stringified: JSON.stringify(error) })
        });

    return FileExecution.Report({ testPath, test, index, start, end, report });
}
