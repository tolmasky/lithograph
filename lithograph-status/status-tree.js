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
        data `Test` (start => number),
        data `Suite` (
            start => number,
            unblocked => Stack(number),
            children => ResultMap) ),
    union `Waiting` (
        data `Test` (test => Node.Test),
        data `Suite` (
            completed => ResultMap,
            waiting => WaitingMap) ),
    Result );

const WaitingMap = Map(number, Status.Waiting);
const ResultMap = OrderedMap(number, Result);


function initialStatusOfNode(node, index = 0)
{
    return is(Node.Test, node) ?
        initialStatusOfTest(node, index) :
        initialStatusOfSuite(node, index);
}

module.exports = initialStatusOfNode;

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
    if (unblocked.size) console.log("UNBLOCKED!", unblocked);
    return { status, unblocked };
}

//function skip

