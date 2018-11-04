const { data, union, is, string, number } = require("@algebraic/type");
const { List, OrderedMap, Map } = require("@algebraic/collections");
const { Node, Suite: { Mode } } = require("@lithograph/ast");
const IndexPath = require("./index-path");
const Result = require("./result");


const TestPathList = List(number);
const ScopeList = List(number);

const Status = union `Status` (
    union `Running` (
        data `Test` (
            test => Node.Test,
            start => number ),
        data `Suite` (
            suite => Node.Suite,
            running => RunningMap,
            waiting => WaitingMap,
            completed => [ResultMap, ResultMap()] ) ),
    union `Waiting` (
        data `Test` (
            test => Node.Test),
        data `Suite` (
            suite => Node.Suite,
            completed => ResultMap,
            waiting => WaitingMap) ),
    Result );

const Report = union `Report` (
    data `Success` (end => number),
    data `Failure` (end => number, reason => Result.Failure.Reason) );

Status.Report = Report;

const { Running, Waiting } = Status;

module.exports = Status;

const WaitingMap = Map(number, Status.Waiting);
const ResultMap = OrderedMap(number, Result);
const RunningMap = OrderedMap(number, Status.Running);


function initialStatusOfNode(node)
{
    return is(Node.Test, node) ?
        initialStatusOfTest(node) :
        initialStatusOfSuite(node);
}

Status.initialStatusOfNode = initialStatusOfNode;

function updateTestPathToRunning(inStatus, testPath, start)
{
    if (testPath === IndexPath.End)
    {
        const { test } = inStatus;

        return { test, status: Running.Test({ test, start }) };
    }

    const { suite, running = RunningMap(), waiting } = inStatus;
    const { children } = suite;
    const [index, nextPath] = IndexPath.pop(testPath, children.size);

    const isRunning = is(Running, inStatus);
    const isRunningChild = isRunning && inStatus.running.has(index);

    const existingChild =
        (isRunningChild ? running : waiting).get(index);
    const { test, status: updatedChild } =
        updateTestPathToRunning(existingChild, nextPath, start);

    const updatedRunning = running.set(index, updatedChild);
    const updatedWaiting = isRunningChild ? waiting : waiting.remove(index);
    if (updatedWaiting.size < waiting.size) console.log("REMOVED " + index);
    const status = Running.Suite(
        { ...inStatus, running: updatedRunning, waiting: updatedWaiting });

    return { test, status };
}

Status.updateTestPathToRunning = updateTestPathToRunning;

function updateTestPathWithReport(inStatus, testPath, report)
{
    if (testPath === IndexPath.End)
    {
        const { test, start } = inStatus;
        const { end } = report;
        const duration = Result.Duration.Interval({ start, end });
        const scopes = ScopeList.of(test.block.id);
        const status = is(Report.Failure, report) ?
            Result.Failure.Test({ test, duration, reason: report.reason }) :
            Result.Success.Test({ test, duration });

        return { unblocked: TestPathList(), scopes, status };
    }

    const { suite } = inStatus;
    const { children: { size } } = suite;
    const [index, nextPath] = IndexPath.pop(testPath, size);

    const existingChild = inStatus.running.get(index);
    const fromChild = updateTestPathWithReport(existingChild, nextPath, report);

    if (!is(Result, fromChild.status))
    {
        const running = inStatus.running.set(index, fromChild.status);
        const unblocked = fromChild.unblocked
            .map(testPath => IndexPath.push(testPath, size, index));
        const scopes = fromChild.scopes;
        const status = Running.Suite({ ...inStatus, running });

        return { unblocked, scopes, status };
    }

    const { unblocked = TestPathList(), waiting, completed: restCompleted } =
        suite.mode === Mode.Concurrent ?
            { ...inStatus, completed: ResultMap() } :
            initialStatusOfChildren(suite.children, hasUnblocked, index + 1);
    const completed = inStatus.completed
        .set(index, fromChild.status)
        .concat(restCompleted);

    if (completed.size === size)
    {
        const children = suite.children
            .map((_, index) => completed.get(index));
        const failed = children.some(is(Result.Failure));
        const status = failed ?
            Result.Failure.Suite({ suite, children }) :
            Result.Success.Suite({ suite, children });
        const scopes = fromChild.scopes.unshift(suite.block.id);

        return { unblocked, scopes, status };
    }

    const running = inStatus.running.remove(index);
    const status = Running.Suite({ suite, waiting, completed, running });
    const scopes = fromChild.scopes;

    return { unblocked, status, scopes };
}

Status.updateTestPathWithReport = updateTestPathWithReport;

function initialStatusOfSuite(suite)
{
    const { block: { disabled, id }, children } = suite;

    if (disabled)
        return assignOriginResultForNode(suite, Result.Skipped, id);

    const isSerial = suite.mode === Mode.Serial;
    const { unblocked, waiting, completed } =
        initialStatusOfChildren(children, isSerial && hasUnblocked);

    // If we have as many results as children, we're done and we have to be
    // Success.
    const status = completed.size === children.size ?
        Result.Success.Suite({ suite, children: completed.toList() }) :
        Status.Waiting.Suite({ suite, completed, waiting });

    return { unblocked, status };
}

function initialStatusOfChildren(children, condition, skip = 0)
{
    const waiting = WaitingMap();
    const completed = ResultMap();
    const unblocked = TestPathList();
    const skipped = skip > 0 ? children.toSeq().skip(skip) : children;
    const { size } = children;

    return skipped.reduce(function (accum, node, unoffsetted)
    {
        if (condition && condition(accum))
            return accum;

        const index = unoffsetted + skip;
        const { unblocked, status } = initialStatusOfNode(node);
        const isResult = is(Result, status);
        const completed = isResult ?
            accum.completed.set(index, status) : accum.completed;
        const waiting = !isResult ?
            accum.waiting.set(index, status) : accum.waiting;
        const concatenated = accum.unblocked.concat(
            unblocked.map(testPath => IndexPath.push(testPath, size, index)));

        return { unblocked:concatenated, waiting, completed };
    }, { unblocked, waiting, completed });
}

function assignOriginResultForNode(node, result, origin)
{
    if (is(Test, node))
        return result.Test({ test: node, origin });

    const children = suite.children
        .map(node => assignOriginResultForNode(node, result, origin));
 
    return result.Suite({ suite: node, origin, children });
}

function hasUnblocked({ unblocked })
{
    return unblocked.size > 0;
}

function initialStatusOfTest(test)
{
    const { block: { disabled, id } } = test;
    const unblocked = disabled ?
        TestPathList() :
        TestPathList.of(IndexPath.End);
    const status = disabled ?
        Result.Skipped.Test({ origin:id, test }) :
        Status.Waiting.Test({ test });

    return { status, unblocked };
}

//function skip

