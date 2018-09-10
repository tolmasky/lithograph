const { List, Map, Record } = require("immutable");
const toGenerator = require("./to-generator");
const FunctionEntry = Record({ id: -1, function:-1 });
const { dirname } = require("path");
const combine = (lhs, rhs) =>
    lhs.map((lhs, index) => lhs.concat(rhs[index]));


module.exports = function(root, environment, filename)
{
    const generator = toGenerator(root, environment, filename);
    const [functions, ranges] = toPairs(generator);

    return { functions: Map(functions), ranges: List(ranges) };
}

function toPairs(generator)
{
    const iterator = generator();
    const type = iterator.next().value;

    return iterator.next(builders[type]).value;
}

const builders =
{
    "concurrent": children =>
        children.map(toPairs).reduce(combine, [[], []]),

    "serial": function (key, range, serial, iterator)
    {
        const concurrentGenerators = iterator.next().value;
        const concurrentPairs = builders["concurrent"](concurrentGenerators);

        if (serial.length > 0)
        {
            iterator.next();
            iterator.waiting = serial[0];
        }

        return combine(
        [
            serial.map(toAsyncPair(iterator)),
            [List.of(key, range)]
        ], concurrentPairs);
    },

    "test": (key, range, f) => [[List.of(key, f)], [List.of(key, range)]]
}

function toAsyncPair(iterator)
{
    return key => List.of(key, () => new Promise(function (resolve, reject)
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
    }));
}
