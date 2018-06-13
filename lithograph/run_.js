
const { Map, Range } = require("immutable");
const Pipeline = require("./pipeline");
const f = index => value => new Promise(function (resolve, reject)
{
const time = Math.random() * 1000;
    console.log(index + " " + value + " " + time);
    setTimeout(resolve, time);
});

const pipeline = Pipeline.init([f(0),f(1),f(2),f(3)]);

program(pipeline, function (pipeline, event)
{
    if (event instanceof Map)
        return Pipeline.update(pipeline, Pipeline.Enqueue({ requests:Range(0,20).map(x => [x]), push:event.get("push") }));

    return Pipeline.update(pipeline, event);
})(Map());


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