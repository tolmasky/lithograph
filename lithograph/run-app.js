const { Range } = require("immutable");
const { IO } = require("cause");
const Process = require("@cause/process");

IO.toPromise(Process.create({ path: "node", args: ["./test/run-app_2.js"] }));

/*const Pool = require("@cause/pool");
const run = require("@cause/asynchronous/run");
const update = require("cause/update");


const Main = Cause("Main",
{
    [field `pool`]: -1,
    [field `initialRequests`]: Range(0, 100),

    init({ count })
    {
        const requests = Range(0, 100);
        const pool = Pool.create({ resources:Range(0, count), requests });

        return { pool };
    },

    [event.on (Cause.Start)]: main => {
        console.log("here!");
        return update.in(main, ["pool"], Pool.Enqueue({ requests: main.initialRequests }))[0]
},
    [event.on (Pool.Allotted)]: function (main, { allotments })
    {console.log(allotments);
        for (const allotment of allotments)
            console.log(allotment.request + " was alloted " + allotment.index);

        const resources = allotments.map(allotment => allotment.index);

        return update.in(main, ["pool"], Pool.Release({ resources }))[0];
    },

    [event.on (Pool.Released)]: function (main, { resources })
    {
        resources.map(resource => console.log(resource + " released"));

        return main;
    }
});

run(Main.create({ count: 10 }));*/
