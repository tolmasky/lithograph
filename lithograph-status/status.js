const { data, union, is, string, number } = require("@algebraic/type");
const { List, Map } = require("@algebraic/collections");
const { Node, NodePath, Suite: { Mode } } = require("@lithograph/ast");

const NodePathList = List(NodePath);
const TestPathList = List(NodePath.Test);

const Result = require("./result");
const ResultMap = Map(number, Result);

const Incomplete = union `Incomplete` (
    union `Running` (
        data `Test` (start => number),
        data `Suite` (start => number, children => ResultMap) ),

    union `Waiting` (
        data `Test` (),
        data `Suite` (children => ResultMap) ) );
const { Running, Waiting } = Incomplete;

const IncompleteMap = Map(number, Incomplete);
const Status = union `Status` (Result, Incomplete);

module.exports = Status;

Status.findUnblockedDescendentPaths = findUnblockedDescendentPaths
Status.updateTestPathToRunning = updateTestPathToRunning;
Status.updateTestPathToSuccess = updateTestPathToSuccess;

// (TestPath, Map<number, Incomplete>, time) ->
// Map<number, Incomplete>
//
// Mark the test found at `testPath` as `Running`, having started at time
// `start`. Recursively mark any parent paths as `Running` as necessary.
//
// Return updated Incomplete map.
function updateTestPathToRunning(testPath, incomplete, start)
{
    const { parent, test: { block: { id } } } = testPath;
    const withSelf = incomplete.set(id, Running.Test({ start }));

    return updateSuitePathToRunning(parent, withSelf, start);
}

// (TestPath, Map<number, Incomplete>, time) ->
// Map<number, Incomplete>
//
// Mark the suite found at `suitePath` as `Running` if it hasn't already, having
// started at time `start` if it hasn't already been marked as so. Recursively
// mark any parent paths as `Running` as necessary.
//
// Return updated Incomplete map.
function updateSuitePathToRunning(suitePath, incomplete, start)
{
    const { parent, suite } = suitePath;
    const { block: { id } } = suite;
    const status = incomplete.get(id);

    // If we're already running, nothing left to do.
    if (is(Running, status))
        return incomplete;

    const { children } = status;
    const running = Running.Suite({ start, children });
    const withSelf = incomplete.set(id, running);

    // As long as we're not the root path, keep going.
    return is(NodePath.Suite.Root, suitePath) ?
        withSelf :
        updateSuitePathToRunning(parent, withSelf, start);
}

function updateTestPathToSuccess(testPath, incomplete, end)
{
    const { test, parent } = testPath;
    const { id } = test.block;
    const { start } = incomplete.get(id);
    const duration = Result.Duration({ start, end });
    const success = Result.Success.Test({ duration, test });
    const incomplete_ = incomplete.remove(id);

    return updateSuitePathWithChildResult(parent, success, incomplete_);
}

function updateSuitePathWithChildResult(suitePath, childResult, incomplete)
{
console.log("UPDATE WITH CHILD RESULT: ", childResult);
process.exit(1);
    const suite = suitePath.suite;
    const { block: { id }, mode, children } = suite;
    const status = incomplete.get(id);
    const childResults = status.children
        .set(Result.id(childResult), childResult);
    /*const incomplete = 
    

    if (childResults.size < children.size)
        return incomplete.set(id,
            Running.Suite({ ...status, children: childResults }));    
*/
    const [siblingStatuses, unblocked, remaining] =
        mode === Suite.Mode.Concurrent ?
            [ResultMap(childResult.id, childResult), TestPathList()] :
            resolveSerialSiblingPaths(
                siblings.toSeq()
                    .map((_, index) => NodePath.child(index, suitePath))
                    .skip(path.index + 1),
                Failure.is(result) && Omitted({ id }));
    const completed = remaining === 0;
    const withSiblings = withResult.concat(siblingStatuses);
    const [withParent, parentUnblocked, exited, root] = completed ?
        updatePathToResult(withSiblings, parent,
            getSuiteStatus(withSiblings, parent)) :
        [withSiblings.setIn([parentId, "remaining"], remaining),
            List(), Stack(), false];
console.log("remaining for" + parent.node.metadata.id + ": " + remaining);
if (completed)
console.log("I SHOULD HAVE SET " + parent.node.metadata.id + " to " + getSuiteStatus(statuses, parent));
    return [withParent, unblocked.concat(parentUnblocked), exited.push(id), root];
}

function findUnblockedDescendentPaths(nodePath, incomplete = IncompleteMap())
{
    return is(NodePath.Test, nodePath) ?
        findUnblockedDescendentPathsOfTestPath(nodePath, incomplete) :
        findUnblockedDescendentPathsOfSuitePath(nodePath, incomplete);
}

function findUnblockedDescendentPathsOfSuitePath(suitePath, incomplete)
{
    const { suite } = suitePath;

    // If we don't have any children, we might as well consider ourselves as
    // `Success`. In practice, the markdown parser should never allow this, but
    // perhaps other ways of constructing Suites may someday create such
    // situations.
    if (suite.children.size <= 0)
        return { unblocked: TestPathList(), status:Result.Success(), incomplete };

    // At this point, we have to recurse to find unblocked paths. However, if
    // all our children are immediately resolvable, there is still a chance that
    // we will thus have an early resolution as well.
    const children = NodePath.Suite.children(suitePath);
    const { unblocked, results, incomplete: withChildren } =
        suite.mode === Mode.Concurrent ?
            resolveConcurrentSiblingPaths(children, incomplete) :
            resolveSerialSiblingPaths(children, false);

    // If we have as many results as children, we're done.
    if (results.size === children.size)
        return { unblocked, result:Result.Success(), incomplete };

    const status = Incomplete.Waiting.Suite({ children: results });
    const updated = withChildren.set(NodePath.id(suitePath), status);

    return { unblocked, status, incomplete: updated };
}

function findUnblockedDescendentPathsOfTestPath(testPath, incomplete)
{
    const { test: { block } } = testPath;

    if (block.disabled)
        throw "DO SOMEHTING";
    
    const status = Incomplete.Waiting.Test;
    const unblocked = TestPathList.of(testPath);
    const updated = incomplete.set(block.id, status);

    return { unblocked, status, incomplete: updated };
}

/*
// (NodePath) ->
// [Map<id, Status>, List<NodePath>, bool]
//
// Given an unblocked path, recursively traverse unblocked children, setting
// them immediately to Skipped or Success if possible.
//
// Return a Map of id's to statuses, a list of newly unblocked leaf nodes
// (Tests), and a boolean showing whether the path is itself completed.
function findUnblockedDescendentPaths(path)
{
    if (TestPath.is(path))
    {
        
    }
    
    const { node } = path;
    const { block: { disabled, id } } = node;

    // If we are disabled, we know that we, and all our descendents, are
    // Skipped.
    if (disabled)
        return updateDescendentPaths(path, Skipped({ id }));

    // If we are a test, we can't be complete, and we can't go further. Simply
    // return ourselves as the sole unblocked path.
    if (node instanceof Test)
        return [Map(), List.of(path), false];

    // If we don't have any children, we might as well consider ourselves as
    // `Success`. In practice, the markdown parser should never allow this, but
    // perhaps other ways of constructing Suites may someday create such
    // situations.
    if (node.children.size <= 0)
        return [Map([id, Success.Suite()]), List(), true];

    // At this point, we have to recurse to find unblocked paths since we are
    // ourselves not a leaf node (a Test). However, if all our children are
    // immediately resolvable, there is still a chance that we will thus have an
    // early resolution as well.
    const children = node.children.map((_, index) => path.child(index));
    const [withChildren, unblocked, remaining] =
        node.mode === Suite.Concurrent ?
            resolveConcurrentSiblingPaths(children) :
            resolveSerialSiblingPaths(children, false);
    const completed = remaining === 0;
    const withSelf = withChildren
        .set(id, completed ? Success.Suite() : Waiting.Suite({ remaining }));

    return [withSelf, unblocked, completed];
}
*/
// (Seq<NodePath>) ->
// [Map<id, Status>, List<NodePath>, integer]
//
// Given a sequence of sibling paths where all paths are unblocked, recursively
// traverse unblocked descendent paths, setting them either to their natural
// immediately resolvable `Result` if possible, or otherwise noting their
// descendent unblocked paths.
//
// Returns a Map of node id's to resolved statuses, the list of any newly
// unblocked paths, and the number of remaining blocked siblings.
function resolveConcurrentSiblingPaths(siblings, incomplete)
{
    const unblocked = TestPathList();
    const results = ResultMap();

    return siblings.reduce(function (accum, nodePath)
    {
        const child = findUnblockedDescendentPaths(nodePath, accum.incomplete);

        const unblocked = accum.unblocked.concat(child.unblocked);        
        const results = is(Result, child.status) ?
            accum.results.set(NodePath.id(nodePath), child.status) :
            accum.results;

        return { unblocked, results, incomplete: child.incomplete };
    }, { unblocked, results, incomplete });
}

/*


        accum.results.

        return [
            concatenated.concat(unblocked),
            is(Result, status) ?
                results.set(NodePath.id(nodePath), status) : results,
            is(Incomplete, state) ?
                incomplete.set(NodePath.id(nodePath), state) : incomplete]

        const concatenated = 
        [nodePath, [unblocked, status]]
    
        
        .reduce(([concatenated, results, incomplete], 
                [nodePath, [unblocked, status]]) =>
            [concatenated.concat(unblocked),
                is(Result, state) ?
                    results.set(NodePath.id(nodePath), state) : results,
                is(Incomplete, state) ?
                    incomplete.set(NodePath.id(nodePath), state) : incomplete],
            [NodePathList(), ResultMap(), IncompleteMap()]);
            
const Status = data `Status`
    `RunningTest` (start => number)
    `RunningSuite` (start => number, children => Map(number, AnyResult))
    `WaitingTest`
    `WatiingSuite` (children => Map(number, AnyResult))

// (Status, NodePath, time) ->
// [Map<id, Status>]
//
// Mark the test found at `path` as `Running`, having started at time `start`.
// Return updated statuses map.
function updateTestToRunning(statuses, path, start)
{
    const { parent, node } = path;
    const withSelf = statuses.set(node.block.id, Status.RunningTest({ start }));

    return updateSuiteToRunning(withSelf, parent, start);
}

function updateSuiteToRunning(statuses, path, start)
{
    const { parent, node } = path;
    const { block: { id } } = node;
    const status = statuses.get(id);

    if (Status.RunningSuite.is(status))
        return statuses;

    const { children } = status;
    const running = Status.RunningSuite({ start, children });
    const withSelf = statuses.set(id, running);

    return parent ?
        updateSuiteToRunning(withSelf, parent, start) :
        withSelf;
}
*/