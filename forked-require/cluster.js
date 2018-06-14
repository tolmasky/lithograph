const { Range, List, EmptyList = List(), Record, Map } = require("immutable");
const forkRequire = require("./fork-require");

const Worker = Record({ index: -1, call:-1 });
const Cluster = Record({ backlog: EmptyList, free: EmptyList, occupied: Map() });


module.exports = function (filename, { count = 4 } = { })
{
    const free = Range(0, 4).toList()
        .map(index => Worker({ index, call:forkRequire(filename, index) }));
    const push = program(Cluster({ free }), update);

    return (...args) =>
        new Promise((resolve, reject) =>
            push({ args, resolve, reject, push }));
}

function update(cluster, event)
{
    if (event.type === "freed")
        return freed(cluster, event);

    const { free, backlog, occupied } = cluster;

    if (free.size === 0)
        return cluster.set("backlog", backlog.push(event));

    const worker = free.get(0);
    const settle = settle => result =>
        (event.push({ type:"freed", index: worker.index }),
        settle(result));

    worker.call(...event.args)
        .then(settle(event.resolve))
        .catch(settle(event.reject))

    return cluster
        .set("free", free.takeLast(free.size - 1))
        .set("occupied", occupied.set(worker.index, worker));
}

function freed(cluster, { index })
{
    const { free, backlog, occupied } = cluster;
    const nextCluster = cluster
        .set("free", free.push(occupied.get(index)))
        .set("occupied", occupied.remove(index))
        .set("backlog", backlog.remove(0));

    return backlog.size <= 0 ?
        nextCluster :
        update(nextCluster, backlog.get(0));
}

function program(state, update, pull)
{
    return function push(event)
    {
        state = update(state, event);

        if (pull)
            pull(state);

        return state;
    };
};
