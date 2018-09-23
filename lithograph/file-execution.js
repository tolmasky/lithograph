const { Record, List, Map, Range, Set } = require("immutable");
const { Cause, IO, field, event, update } = require("@cause/cause");
const { Test, Suite, fromMarkdown } = require("@lithograph/ast");
const NodePath = require("@lithograph/ast/path");
const Status = require("@lithograph/status");
const Pool = require("@cause/pool");
const compile = require("./compile");
const GarbageCollector = require("./garbage-collector");
const toEnvironment = require("./file-execution/to-environment");

require("./magic-ws-puppeteer");
require("./test-worker/static");


const FileExecution = Cause("FileExecution",
{
    [field `path`]: -1,
    [field `root`]: -1,
    [field `pool`]: Pool.create({ count: 100 }),
    [field `running`]: Map(),
    [field `statuses`]: Map(),
    [field `functions`]: Map(),
    [field `garbageCollector`]: -1,

    init: ({ path }) =>
    {
        const node = fromMarkdown(path);
        const root = new NodePath(node);
        const garbageCollector = GarbageCollector.create({ node });

        return { path, root, garbageCollector };
    },

    [event.on (Cause.Ready) .from `garbageCollector`](fileExecution)
    {
        const { root, garbageCollector } = fileExecution;
        const [statuses, unblocked] = Status.findUnblockedDescendentPaths(fileExecution.root);
        const { allocate } = garbageCollector;
        const outFileExecution = fileExecution
            .set("functions", compile(toEnvironment(allocate), root.node))
            .set("statuses", statuses);

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
    {
        const path = request;
        const functions = fileExecution.functions;

        return fileExecution
            .update("statuses", statuses =>
                Status.updateTestToRunning(statuses, path, Date.now()))
            .setIn(["running", path.node.metadata.id],
                IO.fromAsync(() => testRun({ functions, path, index })));
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

    [event.in `TestSucceeded`]: { path:-1, index:-1, end:-1 },
    [event.on `TestSucceeded`]: testFinished,

    [event.in `TestFailed`]: { path:-1, index:-1, end:-1, reason:-1 },
    [event.on `TestFailed`]: testFinished
});

function testFinished(fileExecution, event)
{
    const { path, index, end } = event;
    const failure = event instanceof FileExecution.TestFailed;
    const [statuses, requests, scopes] =
        (failure ? Status.updateTestToFailure : Status.updateTestToSuccess)
        (fileExecution.statuses, path, end, failure && event.reason);
    const outFileExecution = fileExecution
        .set("statuses", statuses)
        .removeIn(["running", path.node.metadata.id]);

    const [updated, events] = update.in.reduce(outFileExecution,
    [
        ["garbageCollector", GarbageCollector.ScopesExited({ scopes })],
        ["pool", Pool.Release({ indexes: [index] })]
    ]);

    // If we exited the root scope, then we're done.
    if (scopes.has(fileExecution.root.node.metadata.id))
    {
    console.log("DONE!");
    process.exit(1000);
        const result = toObject(fileExecution.root.node, reports);

        return [updated, [FileExecution.Finished({ result }), ...events]];
    }

    const [enqueued, fromEnqueueEvents] =
        update.in(updated, "pool", Pool.Enqueue({ requests }));

    return [enqueued, [...events, ...fromEnqueueEvents]];
}

module.exports = FileExecution;

async function testRun({ functions, path, index })
{
    const start = Date.now();
    const { id, title } = path.node.metadata;
    const f = functions.get(id);

    console.log("RUN " + path.node.metadata.id + " -> " + title + " " + Date.now());

    const [failed, reason] = await f()
        .then(() => [false])
        .catch(reason => [true, reason]);
    const end = Date.now();

    console.log("finished " + id + " -> " + title + " " + !failed);

    return failed ? 
        FileExecution.TestFailed({ path, index, end, reason }) :
        FileExecution.TestSucceeded({ path, index, end });
}

function updateReports(inReports, path, report)
{
    const { parent, node } = path;
    const outReports = inReports.set(node.metadata.id, report);

    if (!parent)
        return [outReports, List()];

    const { children: siblings, mode } = parent.node;
    const isSerial = mode === Suite.Serial;
    const siblingsComplete = siblings
        .skip(isSerial ? path.index + 1 : 0)
        .every(sibling => outReports.has(sibling.metadata.id));

    if (siblingsComplete)
        return updateReports(
            outReports,
            parent,
            getSuiteReport(parent, outReports));

    if (isSerial && report.outcome instanceof Report.Failure)
    {
        const failure = getDescendentFailure(report);
        const completed = path.index + 1;
        const descendentReports = Map(siblings
            .skip(completed)
            .flatMap((_, index) =>
                getDescendents(parent.child(index + completed)))
            .map(path => [path.node.metadata.id, failure]));
        const mergedReports = outReports.merge(descendentReports);

        return updateReports(
            mergedReports,
            parent,
            getSuiteReport(parent, mergedReports));
    }

    const unblockedTestPaths = isSerial ?
        getPostOrderLeaves(parent.child(path.index + 1)) :
        List();

    return [outReports, unblockedTestPaths];
}

function getDescendents(path)
{
    return path.node instanceof Test ?
        List.of(path) :
        path.node.children
            .flatMap((_, index) =>
                getDescendents(path.child(index)))
            .push(path);
}

function getDescendentFailure(report)
{
    const reason = Error(
        "Test skipped due to previous failure: " +
        report.outcome.reason);
    const outcome = Report.Failure({ reason });
    const failure = Report({ outcome, duration: 0 });

    return failure;
}

function getSuiteReport(path, reports)
{
    const childReports = path.node.children
        .map(child => reports.get(child.metadata.id));
    const failures = childReports.filter(report =>
        report.outcome instanceof Report.Failure);
    const duration = childReports.reduce(
        (duration, report) => duration + report.duration, 0);
    const outcome = failures.size > 0 ?
        Report.Failure({ reason: failures }) :
        Report.Success();

    return Report({ duration, outcome });
}

function getPostOrderLeaves(path, reports)
{
    const { node } = path;

    if (node instanceof Test)
        return List.of(path);

    if (node.children.size <= 0)
        return List();

    if (node.mode === Suite.Serial)
        return getPostOrderLeaves(path.child(0));

    return node.children.flatMap((_, index) =>
        getPostOrderLeaves(path.child(index)));
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
