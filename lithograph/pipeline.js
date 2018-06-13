const { Range, List, Record, Set } = require("immutable");
const Queue = Record({ backlog:List(), workers:-1, free:List(), occupied:Set(), finished:null });

module.exports = Queue;
Error.stackTraceLimit = 1000;
Queue.Enqueue = Record({ requests:List(), push:-1 });

Queue.Request = Record({ arguments });
Queue.Resolved = Record({ value:-1, index:-1, push:-1 });
Queue.Rejected = Record({ value:-1, index:-1, push:-1 });

Queue.init = function ({ workers: workersIterable, backlog: backlogIterable })
{
    const workers = List(workersIterable);
    const backlog = backlogIterable ? List(backlogIterable) : List();
    const free = Range(0, workers.size).toList();

    return Queue({ workers, free, backlog });
}

Queue.update = function (queue, event)
{
    const update = event.constructor.update;
    const updated = update ? update(queue, event) : queue;
    const { backlog, free, occupied, workers } = updated;

    if (backlog.size <= 0)
        return updated;

    if (free.size <= 0)
        return updated;

    const dequeued = backlog.take(free.size);
    const indexes = free.take(dequeued.size);
    const push = event.get("push");

    dequeued.zipWith((request, index) =>{console.log(request);
        Promise.resolve(workers.get(index)(...request.arguments))
            .then(value => push(Queue.Resolved({ value, index, request })))
            .catch(value => push(Queue.Rejected({ value, index, request }))) },
        indexes);

    return updated
        .set("backlog", backlog.skip(dequeued.size))
        .set("free", free.skip(dequeued.size))
        .set("occupied", occupied.concat(indexes));
}

Queue.Enqueue.update = function (queue, { requests })
{
    return queue.set("backlog", queue.backlog.concat(requests));
}

Queue.Resolved.update =
Queue.Rejected.update = function (queue, event)
{
    const { free, backlog, occupied, finished } = queue;
console.log(event);
    return queue
        .set("free", free.push(event.index))
        .set("occupied", occupied.remove(event.index))
        .set("finished", event);
}
