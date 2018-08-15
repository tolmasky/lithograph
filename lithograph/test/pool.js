const { Record } = require("immutable");
const { Cause, event, property } = require("./cause");
const Allotment = Record({ request:-1, index:-1 }, "Allotment");


const Pool = Cause ("Pool",
{
    [field `backlog`]: List(),
    [field `resources`]: List(),
    [field `free`]: List(),
    [field `occupied`]: Set(),

    init({ resources: iterable, requests })
    {
        const resources = Iterable.Indexed(iterable);
        const backlog = requests ? List(requests) : List();
        const free = Range(0, resources.size).toList();

        return { resources, backlog, free };
    },

    // Let all the events from the internal resources just bubble up.
    [event.expose.from("resources")]: { },

    // Users `enqueue` requests for resources, and we fire an event when
    // said resources are `allotted`.
    [event.in `Enqueue`]: { requests: List() },
    [event.out `Allotted`]: { allotments: List() },

    // Simply note the requests, then see what can be satisfied.
    [event.on `Enqueue`]: (pool, { requests }) =>
        allot(pool.set("backlog", pool.backlog.concat(requests))),

    // Users `release` resources, and in turn we fire events for the 
    // releases as well as the newly allowed allotments.
    [event.in `Release`]: { resources: List() },
    [event.out `Released`]: { resources: List() },

    // Free up the resources, then see if we can allot any of them.
    [event.on `Release`](pool, { resources })
    {
        const { free, backlog, occupied } = pool;
        const released = pool
            .set("free", free.concat(resources))
            .set("occupied", occupied.subtract(event.index));
        const [allotted, events] = allot(pool);

        return [allotted, [Pool.Released({ resources }), ...events]];
    }
});

module.exports = Pool;

function allot(pool)
{
    const { backlog, free, occupied, resources } = pool;

    if (backlog.size <= 0 || free.size <= 0)
        return [pool, []];

    const dequeued = backlog.take(free.size);
    const indexes = free.take(dequeued.size);
    const updated = pool
        .set("backlog", backlog.skip(dequeued.size))
        .set("free", free.skip(dequeued.size))
        .set("occupied", occupied.concat(indexes));

    const allotments = dequeued.zipWith((request, index) =>
        Allotment({ request, index }),
        indexes);

    return [updated, [Pool.Allotted({ allotments })]];
}
