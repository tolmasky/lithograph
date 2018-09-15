const { Record, List, Map, Range } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const { Test, Suite, fromMarkdown } = require("@lithograph/node");
const NodePath = require("@lithograph/node/path");
const Pool = require("@cause/pool");
const compile = require("./compile");
const GarbageCollector = require("./garbage-collector");
const toEnvironment = require("./file-execution/to-environment");

const Report = Object.assign(
    Record({ duration:-1, outcome:-1 }, "Report"),
{
    Success: Record({ }, "Success"),
    Failure: Record({ reason:-1 }, "Failure")
});

const FileExecution = Cause("FileExecution",
{
    [field `path`]: -1,
    [field `root`]: -1,
    [field `pool`]: Pool.create({ count: 100 }),
    [field `running`]: Map(),
    [field `reports`]: Map(),
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
        const { allocate } = garbageCollector;
        const start = Date.now();
        const functions = compile(toEnvironment(allocate), root.node);
        console.log("TOOK: " + (Date.now() - start));
        const requests = getPostOrderLeaves(fileExecution.root);

        return update.in(
            fileExecution.set("functions", functions),
            ["pool"],
            Pool.Enqueue({ requests }));
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

        return fileExecution.setIn(
            ["running", request.node.metadata.id],
            IO.fromAsync(() => testRun({ functions, path, index })));
    },

    [event.out `Finished`]: { },

    [event.in `TestFinished`]: { path:-1, index:-1, report:-1 },
    [event.on `TestFinished`](fileExecution, { report, path, index })
    {
        const [reports, requests] =
            updateReports(fileExecution.reports, path, report);
        const finished = reports.has(fileExecution.root.node.metadata.id);
        const [released, fromReleaseEvents] = update.in(
            fileExecution
                .set("reports", reports)
                .removeIn(["running", path.node.metadata.id]),
            "pool",
            Pool.Release({ indexes: [index] }));

        if (finished)
            return [released, [FileExecution.Finished(), ...fromReleaseEvents]];

        const [enqueued, fromEnqueueEvents] =
            update.in(released, "pool", Pool.Enqueue({ requests }));

        return [enqueued, [...fromReleaseEvents, ...fromEnqueueEvents]];
    },
});

module.exports = FileExecution;

async function testRun({ functions, path, index })
{
    const start = Date.now();
    const { id, title } = path.node.metadata;
    const f = functions.get(id);

    console.log("RUN " + path.node.metadata.id + " -> " + title + " " + Date.now());

    const outcome = await f()
        .then(() => Report.Success())
        .catch(reason => Report.Failure({ reason }));
    const report = Report({ duration: Date.now() - start , outcome });

    console.log("finished " + id + " -> " + title + " " + report);

    return FileExecution.TestFinished({ path, index, report });
}

function updateReports(inReports, path, report)
{
    const { parent, node } = path;
    const outReports = inReports.set(node.metadata.id, report);

    if (!parent)
        return [outReports, List()];

    const { children: siblings, mode } = parent.node;
    const isSerial = mode === Suite.Serial;
    const siblingsComplete = isSerial ?
        path.index === siblings.size - 1 :
        siblings.every(sibling =>
            outReports.has(sibling.metadata.id));

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

function getPostOrderLeaves(path)
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

function getBrowser(ranges)
{
    console.log("GET BROWSER CALLED", ranges, getFrames());
    /*
    const frames = getFrames();
    let index = frames.length - 1;

    while (index-- > 0)
    {
        const range = ranges.find(([id, range]) => inRange(frames[index], range));

        if (range)
            console.log("FOUND IT: ", JSON.stringify(range, null, 2), frames[index], " belonging to " + range.get(0));
    }
    
    
    process.exit(1);*/
}

function inRange({ line, column }, { start, end })
{
    return  line > start.line && line < end.line ||
            line === start.line && column > start.column ||
            line === end.line && column < end.column;
}
