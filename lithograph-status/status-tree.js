const { data, union, is, string, number } = require("@algebraic/type");
const { List, OrderedMap, Map } = require("@algebraic/collections");
const { Node, Suite: { Mode } } = require("@lithograph/ast");
const Result = require("./result");

const NodePath = union `NodePath` (
    data `Test` (index => number),
    data `Suite` (index => number, next => NodePath) );

const NodePathList = List(NodePath);

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

module.exports = Status;

const WaitingMap = Map(number, Status.Waiting);
const ResultMap = OrderedMap(number, Result);
const RunningMap = OrderedMap(number, Status.Running);


function initialStatusOfNode(node, index = 0)
{
    return is(Node.Test, node) ?
        initialStatusOfTest(node, index) :
        initialStatusOfSuite(node, index);
}

Status.initialStatusOfNode = initialStatusOfNode;

function updateChildPathToRunning(status, childPath, start)
{
    if (is(Status.Waiting.Test, status))
    {
        const { test } = status;

        return { test, status:Status.Running.Test({ test, start }) };
    }

    const { index, next } = childPath;
    const isRunning = is(Status.Running.Suite, status);
    const childIsRunning = isRunning && status.running.has(index);
    console.log("CHILD IS RUNNING: ", childIsRunning);
    if (!childIsRunning) console.log(status);
    const existingChild = childIsRunning ?
            status.running.get(index) :
            status.waiting.get(index);
    const { test, status: updatedChild } =
        updateChildPathToRunning(existingChild, next, start);
    const running = (isRunning ? status.running : RunningMap())
        .set(index, updatedChild);
    const waiting = childIsRunning ?
        status.waiting : status.waiting.remove(index);
    const { suite } = status;

    return { test, status: Status.Running.Suite({ suite, running, waiting }) };
}

Status.updateChildPathToRunning = updateChildPathToRunning;

function updateChildPathToSuccess(inStatus, childPath, end)
{
    if (is(Status.Running.Test, inStatus))
    {console.log(inStatus);
        const { test, start } = inStatus;
        const duration = Result.Duration.Interval({ start, end });
        const status = Result.Success.Test({ test, duration });

        return { unblocked:NodePathList(), status };
    }

    const { index, next } = childPath;
    const existingChild = inStatus.running.get(index);
    const { unblocked, status: updatedChild } =
        updateChildPathToSuccess(existingChild, next, end);
    const completedChild = is(Result, updatedChild);
    const running = completedChild ?
        inStatus.running :
        inStatus.running.set(index, updatedChild);
    const completed = completedChild ?
        inStatus.completed.set(index, updatedChild) :
        inStatus.completed;
    const { suite } = inStatus;

    if (completed.size === suite.children.size)
    {
        const children = suite.children
            .map((_, index) => completed.get(index));
        const failed = children.some(is(Result.Failure));
        const status = failed ?
            Result.Failure.Suite({ suite, children }) :
            Result.Success.Suite({ suite, children });

        return { unblocked, status };
    }

    const status = Status.Running.Suite({ ...inStatus, completed, running });

    return { unblocked, status };
}

Status.updateChildPathToSuccess = updateChildPathToSuccess;

function initialStatusOfSuite(suite, index)
{
    const { block: { disabled, id }, children } = suite;

    if (disabled)
        return assignOriginResultForNode(suite, Result.Skipped, id);

    const isSerial = suite.mode === Mode.Serial;
    const condition = isSerial && constrainToOneUnblockedChild;
    const { unblocked, waiting, completed } =
        initialStatusOfChildren(children, index, condition);

    // If we have as many results as children, we're done and we have to be
    // Success.
    const status = completed.size === children.size ?
        Result.Success.Suite({ suite, children: completed.toList() }) :
        Status.Waiting.Suite({ suite, completed, waiting });

    return { unblocked, status };
}

function initialStatusOfChildren(siblings, parentIndex, condition)
{
    const unblocked = NodePathList();
    const waiting = WaitingMap();
    const completed = ResultMap();

    return siblings.reduce(function (accum, node, index)
    {
        if (condition && condition(accum))
            return accum;

        const { unblocked, status } = initialStatusOfNode(node, index);
        const isResult = is(Result, status);
        const completed = isResult ?
            accum.completed.set(index, status) : accum.completed;
        const waiting = !isResult ?
            accum.waiting.set(index, status) : accum.waiting;
        const concatenated = accum.unblocked.concat(
            unblocked.map(next => NodePath.Suite({ index: parentIndex, next })));

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

function constrainToOneUnblockedChild({ unblocked })
{
    return unblocked.size > 0;
}

function initialStatusOfTest(test, index)
{
    const { block: { disabled, id } } = test;
    const unblocked = disabled ?
        NodePathList() :
        NodePathList.of(NodePath.Test({ index }));
    const status = disabled ?
        Result.Skipped({ origin:id, test }) :
        Status.Waiting.Test({ test });

    return { status, unblocked };
}

//function skip

