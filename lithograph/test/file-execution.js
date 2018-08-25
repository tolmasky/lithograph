const { Record, List, Map, Range } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const LNode = require("cause/lnode");
const Pool = require("@cause/pool");
const Scope = require("./scope");

const { Suite, Test, Block, fromMarkdown } = require("./suite");
const TestPath =
{
    root: node =>
        new LNode({ index:0, node, scope: Scope(), id:"0" }),
    child: (parent, scope, index, child) => ((data, node) =>
        new LNode({ index, scope, id: `${data.id},${index}`, node }, parent))
        (parent.data, child || parent.data.node.children.get(index))
};

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
    [field `pool`]: Pool.create({ count: 2 }),
    [field `running`]: Map(),
    [field `reports`]: Map(),

    init: ({ path }) =>
        ({ path, root: TestPath.root(fromMarkdown(path)) }),

    [event.on (Cause.Start)]: fileExecution => { console.log("START ",fileExecution.root.data.node.metadata.title);
        return update.in(fileExecution, ["pool"], Pool.Enqueue(
            { requests: getPostOrderLeaves(fileExecution.root) })) },

    [event.on (Pool.Retained)]: (fileExecution, { index, request }) =>
        fileExecution.setIn(
            ["running", request.data.id],
            IO.fromAsync(() => testRun({ path: request, index }))),

    [event.out `Finished`]: { },

    [event.in `TestFinished`]: { path:-1, index:-1, report:-1 },
    [event.on `TestFinished`](fileExecution, { report, path, index })
    {
        const [reports, requests] =
            updateReports(fileExecution.reports, path, report);
        const finished = reports.has(fileExecution.root.data.id);
        const [released, fromReleaseEvents] = update.in(
            fileExecution
                .set("reports", reports)
                .removeIn(["running", path.data.id]),
            "pool",
            Pool.Release({ indexes: [index] }));

        if (finished)
            return [released, [FileExecution.Finished(), ...fromReleaseEvents]];

        const [enqueued, fromEnqueueEvents] =
            update.in(released, "pool", Pool.Enqueue({ requests }));

        return [enqueued, [...fromReleaseEvents, ...fromEnqueueEvents]];
    }
});

module.exports = FileExecution;

async function testRun({ path, index })
{
    const start = Date.now();
    const { scope, node: test } = path.data;
    const blocks = test.children;

    console.log("RUN " + test.metadata.title);

    const content = blocks.map(block => block.code).join("\n");
    const source = `(async () => { ${content} })`;

    await scope(source)();

    const outcome = Report.Success();
    const report = { duration: Date.now() - start , outcome };

    return FileExecution.TestFinished({ path, index, report });
}

function updateReports(inReports, path, report)
{
    const { next: parent, data } = path;
    const outReports = inReports.set(data.id, report);

    if (!parent)
        return [outReports, List()];

    const { node: suite, scope, id } = parent.data;
    const isSerial = suite.metadata.schedule === Suite.Serial;
    const siblings = suite.children;
    const siblingsComplete = isSerial ?
        data.index === siblings.size - 1 :
        siblings.every((_, index) =>
            outReports.has(`${id},${index}`));

    if (siblingsComplete)
        return updateReports(
            outReports,
            parent,
            getSuiteReport(parent, outReports));

    const unblockedTestPaths = isSerial ?
        getPostOrderLeaves(TestPath.child(parent, scope, data.index + 1)) :
        List();

    return [outReports, unblockedTestPaths];
}

function getSuiteReport(path, reports)
{
    const { data: { id, node: suite } } = path;
    const childReports = suite.children
        .map((_, index) => reports.get(`${id},${index}`));
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
    const { data: { node, scope } } = path;

    if (node instanceof Test)
        return List.of(path);

    const { children } = node;

    if (node.children.size <= 0)
        return List();

    if (node.metadata.schedule === Suite.Serial)
        return getPostOrderLeaves(TestPath.child(path, scope, 0));

    return node.children.flatMap((node, index) =>
        getPostOrderLeaves(TestPath.child(path, Scope(scope), index, node)));
}
