const { Seq, Record, List, Map } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const findShallowestScope = require("@lithograph/node/find-shallowest-scope");
const getBacktrace = require("./get-frames");

const Request = Record({ id:-1, resolve:-1 }, "Request");
const Allocation = Record({ id:-1, type:-1 }, "Allocation");


const GarbageCollector = Cause("GarbageCollector",
{
    [field `ready`]: false,
    [field `allocate`]: -1,
    [field `allocateIO`]: -1,

    init: ({ node }) => ({ allocateIO: toAllocateIO(node) }),

    [event.in `AllocateReady`]: { allocate: -1 },
    [event.on `AllocateReady`]: (endpoints, { allocate }) => {
    console.log(allocate);
return    [
        endpoints
            .set("allocate", allocate)
            .set("ready", true),
        [Cause.Ready()]
    ] },

    [event.in `Request`]: { scope: -1, type: -1, resolve: -1 },
    [event.on `Request`](collector, request)
    {
        const id = collector.allocating.get("id");
        const updated = collector.update("requests",
            requests => requests.concat([["id", id + 1], [id, request]]));
        const allocate = GarbageCollector.Allocate({ id, type: request.type });

        return [updated, [allocate]];
    },

    [field `node`]: -1,
    [field `requests`]: Map({ id: 0 }),
    [field `allocations`]: Map(),
    [field `resolutions`]: List(),

    [event.in `Allocated`]: { id: -1, resource:-1 },
    [event.on `Allocated`](collector, allocation)
    {
        const { id, resource } = allocation;
        const { scope, resolve } = collector.requests.get(id);
        const resolution = IO.fromAsync(() => resolve({ resource }));

        return collector
            .setIn(["allocations", scope, id])
            .updateIn("resolutions", list => list.push(resolution));
    },

    [event.out `Deallocate`]: { allocations:List() },

    [event.in `ScopeExited`]: { scope: -1 },
    [event.on `ScopeExited`]: (collector, { scope }) =>
    [
        collector.removeIn(["allocations", scope]),
        [GarbageCollector
            .Release({ allocations: collector.allocations.get(scope) })]
    ]
});

module.exports = GarbageCollector;

function toAllocateIO(node, push)
{
    if (!push)
        return IO.start(() => toAllocateIO(node, push));

    push(GarbageCollector.AllocateReady({ allocate }));

    function allocate(type)
    {
        return new Promise(function (resolve, reject)
        {
            const backtrace = getBacktrace();
            const scope = findShallowestScope(node, backtrace);

            // If for whatever reason we don't find a matching scope, we'll have
            // to return an error immediately.
            if (!scope)
                return reject(
                    Error("A browser was attempting to be created out of scope"));

            const sanitize = ({ error, resource }) =>
                void(typeof error === "function" ?
                    reject(error()) : resolve(resource));

            push(GarbageCollector.Allocate({ scope, resolve: sanitize, type }));
        });
    }
}
