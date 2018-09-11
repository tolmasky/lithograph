const { Record, List, Map } = require("immutable");
const { Cause, IO, field, event, update } = require("cause");
const getBacktrace = require("./get-frames");


const GarbageCollector = Cause("GarbageCollector",
{
    [field `ready`]: false,
    [field `allocate`]: -1,
    [field `generateAllocate`]: IO.start(generateAllocate),

    [event.in `AllocateReady`]: { allocate: -1 },
    [event.on `AllocateReady`]: (endpoints, { allocate }) =>
    [
        endpoints
            .set("allocate", allocate)
            .set("ready", true),
        [Cause.Ready()]
    ],

    [event.on `Request`](collector, { backtrace, type, resolve })
    {
        // We start by determining where the request for allocation came from
        // by backtracking up the stack trace until we find a frame that exists
        // in one of our known scopes.
        //
        // Note: Seq.map is lazy, so although this appears like it will perform
        // the initial search on every frame in the backtrace due to the `map`,
        // we'll actually exit early as soon as we find a match.
        const scope = Seq(backtrace)
            .map(frame => findIn(inRange, frame, collector.scope))
            .findLast(scope => !!scope);

        // If for whatever reason we don't find a matching scope, we'll have to
        // return an error immediately.
        if (!scope)
            return collector.updateIn("resolutions",
                list => list.push(IO.fromAsync(() =>
                    void(resolve({ error: Error.OutOfBounds })))));

        const id = collector.allocating.get("id");
        const allocation = Allocation({ id, type, scope: scope.id });
        const allocating = collector.allocating
            .concat([["id", id + 1], [id, allocation]]);

        const outCollector = collector.setIn("allocating", allocating);
        const outEvent = GarbageCollector.Allocate({ allocation });

        return [outCollector, [outEvent]];
    },

    [field `scope`]: -1,
    [field `allocating`]: Map({ id: 0 }),
    [field `allocations`]: Map(),
    [field `resolutions`]: List(),

    [event.in `Allocated`]: { allocation: -1, resource:-1 },
    [event.on `Allocated`](collector, { allocation, resource })
    {
        const { owner, resolve } = collector.allocating.get(allocation.id);
        const resolution = IO.fromAsync(() =>
            void(resolve({ value: resource })));

        return collector
            .setIn(["living", owner.scope.id, allocation.id])
            .updateIn("resolutions", list => list.push(resolution));
    },

    [event.out `Deallocate`]: { allocations:List() },

    [event.in `ScopeExited`]: { id: -1 },
    [event.on `ScopeExited`]: (collector, { id }) =>
    [
        collector.removeIn(["allocations", id]),
        [GarbageCollector
            .Release({ allocations: collector.allocations.get(id) })]
    ]
});

module.exports = GarbageCollector;

function generateAllocate(push)
{
    push(GarbageCollector.AllocateReady({ allocate }));

    function allocate(type)
    {
        return new Promise(function (resolve, reject)
        {
            const backtrace = getBacktrace();
            const sanitize = ({ error, value }) =>
                typeof error === "function" ?
                    reject(error()) : resolve(value);

            push(GarbageCollector
                .Request({ backtrace, resolve: sanitize, type }));
        });
    }
}
