const { List, Map, Range, Record, Set, Stack } = require("immutable");
const { Suite, Test } = require("../lithograph-ast");

const is = type => value => value instanceof type;

function Status(test, suite, name)
{
    return name === void(0) ?
        (type => Object.assign(type, { is: is(type) }))
            (Record(test, suite)) :
        (([Test, Suite]) =>
            ({ Test, Suite, is: v => Test.is(v) || Suite.is(v) }))
        ([Status(test, `${name}.Test`), Status(suite, `${name}.Suite`)])
}

const None = false;
const Waiting = Status(
    { },
    { remaining: -1 }, "Waiting");
const Running = Status(
    { start: -1 },
    { start: -1, remaining: -1 }, "Running");
const Failure = Status(
    { duration:-1, reason:-1 },
    { durations:List(), failures:List() }, "Failure");
const Success = Status(
    { duration:-1 },
    { durations:List(), total:-1, self:-1 }, "Success");
const Omitted = Status({ id:-1 }, "Omitted");
const Skipped = Status({ id:-1 }, "Skipped");

module.exports = Object.assign(
    { updateTestToRunning },
    { updateTestToSuccess },
    { updateTestToFailure },
    { findUnblockedDescendentPaths });


// (Map<id, Status>, NodePath, time) ->
// [Map<id, Status>]
//
// Mark the test found at `path` as `Running`, having started at time `start`.
// Return updated statuses map.
function updateTestToRunning(statuses, path, start)
{
    const { parent, node } = path;
    const withSelf = statuses.set(node.metadata.id, Running.Test({ start }));

    return updateSuiteToRunning(withSelf, parent, start);
}

function updateSuiteToRunning(statuses, path, start)
{
    const { parent, node } = path;
    const { metadata: { id } } = node;
    const status = statuses.get(id);

    if (Running.is(status))
        return statuses;

    const { remaining } = status;
    const running = Running.Suite({ start, remaining });
    const withSelf = statuses.set(id, running);

    return parent ?
        updateSuiteToRunning(withSelf, parent, start) :
        withSelf;
}

// (Map<id, Status>, NodePath, time) ->
// [Map<id, Status>, List<NodePath>, Stack<NodeId>]
//
// Mark a test as having succeeded at time `time`, calculating any other results
// that may be created as a consequence, and returning any newly unblocked paths.
function updateTestToSuccess(statuses, path, end)
{
    const running = statuses.get(path.node.metadata.id);
    const duration = Range(running.start, end);

    return updatePathToResult(statuses, path, Success.Test({ duration }));
}

// (Map<id, Report>, NodePath, Object, time) ->
// [Map<id, Report>, List<NodePath>, Stack<NodeId>]
//
// Mark a test as having failed with `reasin` at time `time`, calculating any
// other results that may be created as a consequence, and returning any newly
// unblocked paths.
function updateTestToFailure(statuses, path, reason, end)
{
    const running = statuses.get(path.node.metadata.id);
    const duration = Range(running.start, end);
    const failure = Failure.Test({ duration, reason: error });

    return updatePathToResult(statuses, path, failure);
}

// (Map<id, Status>, NodePath, Success | Failure) ->
// [Map<id, Status>, List<NodePath>, Stack<NodeId>]
//
// Assign a report to the node at `path`, calcualting any other reports that may
// be created as a consequence, and return newly unblocked paths.
function updatePathToResult(statuses, path, result)
{
    const { parent, node } = path;
    const { metadata: { id } } = node;
    const withResult = statuses.set(id, result);

    // If we have no parent, we've resolved the last status in the tree.
    if (!parent)
        return [withResult, List(), Stack.of(id)];

    const { mode, children: siblings } = parent.node;
    const parentId = parent.node.metadata.id;
    const parentReport = statuses.get(parentId);
    const [siblingStatuses, unblocked, remaining] =
        mode === Suite.Concurrent ?
            [Map(), List(), parentReport.remaining - 1] :
            resolveSerialSiblingPaths(
                siblings.toSeq()
                    .map((_, index) => parent.child(index))
                    .skip(path.index + 1),
                Failure.is(result) && Omitted({ id }));
    const completed = remaining === 0;
    const withSiblings = withResult.concat(siblingStatuses);
    const [withParent, parentUnblocked, exited] = completed ?
        updatePathToResult(withSiblings, parent, getSuiteResult(parent)) :
        [withSiblings.setIn([parentId, "remaining"], remaining), List(), Stack()];

    return [withParent, unblocked.concat(parentUnblocked), exited.push(id)];
}

function getSuiteReport(path)
{
    const { node: { children } } = path;
    const childPairs = path.children
        .map(child => child.metadata.id)
        .map(id => [id, reports.get(id)])
        .filter(([, report]) =>
            Success.is(report) || Failure.is(report));
    const failures = childPairs
        .filter(([, report]) => Failure.is(report))
        .map(([id]) => id);

    return failures.size > 0 ?
        Failure.Suite({ failures }) :
        Success.Suite();
}

// (Seq<NodePath>, Maybe<Omitted>) ->
// [Map<id, Status>, List<NodePath>, integer]
//
// Given a sequence of contiguous sibling paths where the first path is
// unblocked, and a possible Omitted status, recursively traverse unblocked
// descendent paths, setting them either to the Omitted status if present, or
// their natural immediately resolvable status if possible.
//
// Returns a Map of node id's to resolved statuses, the list of any newly
// unblocked paths, and the number of remaining blocked siblings.
function resolveSerialSiblingPaths(siblings, omitted)
{
    const forSiblings = siblings
        .map(path => omitted ?
            setDescendentPathsToStatus(path, omitted) :
            findUnblockedDescendentPaths(path));
    const completed = forSiblings.count(([, , completed]) => completed);

    // We add one because `completed` represents every resolved path, so the one
    // that follows must be unblocked. We want to take all of its unblocked
    // descendents, as well as making sure its parents are marked as Waiting.
    // Don't worry if completed + 1 > size, `take` ignores anything pass the end.
    const [statuses, unblocked] = forSiblings
        .take(completed + 1)
        .reduce(([statuses, unblocked], forSibling) =>
            [statuses.concat(forSibling[0]), unblocked.concat(forSibling[1])],
            [Map(), List()]);
    const remaining = siblings.size - completed;

    return [statuses, unblocked, remaining];
}

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
    const { node } = path;
    const { metadata: { disabled, id } } = node;

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

// (Seq<NodePath>) ->
// [Map<id, Status>, List<NodePath>, integer]
//
// Given a sequence of sibling paths where all paths are unblocked, recursively
// traverse unblocked descendent paths, setting them either to their natural
// immediately resolvable status if possible, or otherwise noting their
// descendent unblocked paths.
//
// Returns a Map of node id's to resolved statuses, the list of any newly
// unblocked paths, and the number of remaining blocked siblings.
function resolveConcurrentSiblingPaths(siblings)
{
    const forSiblings = siblings
        .map(path => findUnblockedDescendentPaths(path));
    const completed = forSiblings.count(([, , completed]) => completed);
    const [statuses, unblocked] = forSiblings.reduce(
        ([statuses, unblocked], forSibling) =>
            [statuses.concat(forSibling[0]), unblocked.concat(forSibling[1])],
        [Map(), List()]);

    return [statuses, unblocked, siblings.size - completed];
}

// (NodePath, Skipped | Omitted) ->
// [Map<id, Report>, List<NodePath>.size === 0, boolean = true]
//
// Given an unblocked path, recursively traverse all descendents with a passed
// result of either Skipped or Omitted, taking into account that if a Node is
// disabled, it will receive the state of Skipped even if the requested state
// was Omitted.
//
// Returns a Map of node id's to resolved statuses, an empty list and the boolean
// true marking that this path is in fact now complete.
function setDescendentPaths(path, result)
{
    const pairs = getDescendentPairs(path.node, result);
    const statuses = Map(pairs);

    return [statuses, List(), true];
}

// (Suite | Test, Skipped | Omitted) ->
// List<[id, Skipped | Omitted]>
//
// Given a node and a requested status of either Skipped or Omitted, return a
// List of pairs from node id to the requested end state of either Skipped or
// Omitted, taking into account that if a Node is disabled, it will be paired
// with Skipped even if the requested state was Omitted.
function getDescendentPairs(node, request)
{
    const { metadata: { disabled, id } } = node;
    const report = disabled ? Skipped({ id }) : request;

    return node instanceof Test ?
        List.of([id, report]) :
        node.children
            .flatMap(node => getDescendentPairs(node, report))
            .push([node.metadata.id, report]);
}
