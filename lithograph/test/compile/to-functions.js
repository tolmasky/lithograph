const { List, Map, Record } = require("immutable");
const toGenerator = require("./to-generator");
const FunctionEntry = Record({ id: -1, function:-1 });
const { dirname } = require("path");


module.exports = function(root, environment, filename)
{
    const generator = toGenerator(root, environment, filename);

    return Map(toPairs(generator));
}

function toPairs(generator)
{
    const iterator = generator();
    const type = iterator.next().value;

    return iterator.next(builders[type]).value;
}

const builders =
{
    "concurrent": (children) =>
        [].concat(...children.map(
            generator => toPairs(generator))),

    "serial": iterator => (function ([concurrent, serial])
    {
        if (serial.length > 0)
        {
            iterator.next();
            iterator.waiting = serial[0];
        }

        const pairs =
        [
            ...[].concat(...concurrent.map(toPairs)),
            ...serial.map(key => List.of(key, toAsync(key, iterator)))
        ];
     
        return pairs;   
    })(iterator.next().value),

    "test": (key, f) => [List.of(key, f)]
}

function toAsync(key, iterator)
{
    return () => new Promise(function (resolve, reject)
    {
        if (iterator.waiting !== key)
            throw Error(`Attempted to run test ${key} before it was ready.`);

        (function step(method, input)
        {
            const { done, value } = iterator[method](input);
            const border = !done && value.name === "start";

            if (border)
                iterator.waiting = value.value;

            if (done || border)
                return resolve();

            Promise.resolve(value.value)
                .then(value => step("next", value))
                .catch(value => step("throw", value));
        })("next", void 0);
    });   
}
