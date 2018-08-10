const { normalize, relative } = require("path");
const getCommonPath = require("./get-common-path");

const { List, Map, Range, Record } = require("immutable");
const Queue = require("./pipeline");
const Run = Record({ paths:-1, queue:-1 });

const forkRequire = require("forked-require");


module.exports = function (paths, options)
{
    //const basePath = getCommonPath(paths);

    return new Promise(function (resolve, reject)
    {
        program(Run.init(paths, options), Run.update, function (run, event)
        {
            console.log("running...");

            //if (run.results.has(suite))
            //    console.log("ALL DONE");
        })(Map());
    });
}

function program(state, update, pull)
{
    return function push(event)
    {
        state = update(state, event.set("push", push));

        if (pull)
            pull(state);

        return state;
    };
};


Run.init = function (paths, options)
{
    const { concurrency, headless, browserLogs } = options;
    const requires = JSON.stringify(options.requires || []);
    const workers = Range(0, concurrency)
        .map(index => forkRequire(`${__dirname}/run-file.js`,
            Object.assign({ UUID: index, headless, requires },
                browserLogs && { browserLogs })));
    const requests = paths.map(path =>
        Queue.Request({ arguments:List.of(path) }));

    return Run({ queue: Queue.init({ workers, requests }) });
}

Run.update = function (run, event)
{
    return run.set("queue", Queue.update(run.queue, event));
}
