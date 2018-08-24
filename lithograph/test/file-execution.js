const { Record, List, Map, Range } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const LNode = require("cause/lnode");
const Pool = require("@cause/pool");

const { Suite, Test, Block, fromMarkdown } = require("./suite");
const TestPath =
{
    root: node => new LNode({ index:0, node, id:"0" }),
    child: (parent, index, child) => ((data, node) =>
        new LNode({ index, id: `${data.id},${index}`, node }, parent))
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
    [field `root`]: -1,
    [field `pool`]: Pool.create({ count: 2 }),
    [field `running`]: Map(),
    [field `reports`]: Map(),

    init: ({ path }) =>
        ({ root: TestPath.root(fromMarkdown(path)) }),

    [event.on (Cause.Start)]: fileExecution =>
        update.in(fileExecution, ["pool"], Pool.Enqueue(
            { requests: getUnblockedTestPaths(
                fileExecution.root, fileExecution.reports) })),

    [event.on (Pool.Released)]: event.ignore,
    [event.on (Pool.Allotted)]: (fileExecution, { allotments }) =>
        fileExecution.set("running", fileExecution.running
            .merge(Map(allotments.map(({ request: path, index }) =>
                [path.data.id, IO.fromAsync(() => testRun({ path, index })) ])))),

    [event.out `Finished`]: { },

    [event.in `TestFinished`]: { path:-1, index:-1, report:-1 },
    [event.on `TestFinished`](fileExecution, { report, path, index })
    {console.log("FINISHED!" + path.data.node.metadata.title);
        const reports = fileExecution.reports.set(path.data.id, report);
        const requests = getUnblockedTestPaths(path, reports);
        const release = Pool.Release({ index: [index] });
        const enqueue = requests.size > 0 && Pool.Enqueue({ requests });

        return update.in_(
            ["pool"],
            [release, enqueue],
            fileExecution
                .set("reports", reports)
                .removeIn(["running", path.data.id]));
    }
});

module.exports = FileExecution;

async function testRun({ path, index })
{
    const start = Date.now();
console.log("RUN " + path.data.node.metadata.title);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const outcome = Report.Success();
    const report = { duration: Date.now() - start , outcome };

    return FileExecution.TestFinished({ pathn, index, report });
}

function getUnblockedTestPaths(path, reports)
{
    if (!reports.has(path.data.id))
        return getPostOrderLeaves(path);

    const { parent, index } = path;

    if (!parent)
        return List();

    const suite = parent.node;
    const isSerial = suite.metadata.schedule === Suite.Serial;
    const siblings = suite.children;
    const siblingsComplete = isSerial ? 
        index === siblings.size - 1 :
        siblings.every(sibling => reports.has(sibling));

    if (!siblingsComplete)
        return isSerial ?
            [getPostOrderLeaves(TestPath.child(parent, index + 1)), results] :
            [List(), results];

    return getUnblockedTestPaths(
        parent, 
        reports.set(parent.id, getSuiteReport(suite, reports)));
}

function getSuiteReport(path, reports)
{
    const childReports = suite.children
        .map((_, index) => reports.get(`${path.data.id},${index}`));
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
    const { data: { node } } = path;

    if (node instanceof Test)
        return List.of(path);

    const { children } = node;

    if (node.children.size <= 0)
        return List();

    if (node.metadata.schedule === Suite.Serial)
        return getPostOrderLeaves(TestPath.child(path, 0));

    return node.children.flatMap((node, index) =>
        getPostOrderLeaves(TestPath.child(path, index, node)));
}

/*

    {
        const pairs = allotments.map(({ request: path, key }) =>
        [
            path.id, AsynchronousCause.from(testRun, { path, key })
        ]);
        
        return fileExecution.set("running", running);
    }

        const running = fileExecution.running.concat(Map(pairs));

        return update.start.all(
            pairs.map(pair => ["running", pair[1]]),
            fileExecution.set("running", running));

*/
