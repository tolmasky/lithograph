const { List, Map, Record } = require("immutable");
const toGenerator = require("./to-generator");
const FunctionEntry = Record({ id: -1, function:-1 });


module.exports = function(root)
{
    return Map(toPairs(toGenerator(root)));
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
    {console.log("== " + iterator.waiting);
        if (iterator.waiting !== key)
            throw Error(`Attempted to run test ${key} before it was ready.`);

        (function step(method, input)
        {console.log("INCOMING WITH " + method + " " + input);
            const { done, value } = iterator[method](input);
            const border = !done && value.name === "start";
console.log("IT IS" , value, border);
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

//console.log(Map(toPairs(generator)));
//console.log("DONE!");




/*
yield { waitFor: path.id }

[[path, TEST], 


const source = generate(construct(suite, "0")).code;
const x = new Function("return (" + source + ")()");

console.log(source);
console.log(x());


/*
function construct(node, id)
{
    if (node instanceof Test)
        return parse(`(function f_${id}() { return [(async () => { ` + node.children
            .map(({ code }) => code)
            .join("\n") + "})] })").program.body[0].expression;

    const { schedule } = node.metadata;
    
    if (schedule === "Serial")
        return toSerial(node, id);

    const children = t.arrayExpression(
        node.children.map((node, index) =>
            construct(node, `${id}_${index}`)).toArray());
    const name = t.Identifier(`${node.metadata.schedule}_${id}`);

    return CONCURRENT_FUNCTION({ name, children }).expression;
}

function fromConcurrent(path)
{
    const { node: suite } = path.data;

    return node.children.flatMap((node, index) =>
    {
        if (node instanceof Test)
            
        const { } = 
        
        if (serial)
            
        
        construct(child(suite, index, node)));
    }
    const children = t.arrayExpression(
        node.children.map((node, index) =>
            construct(node, `${id}_${index}`)).toArray());
    const name = t.Identifier(`${node.metadata.schedule}_${id}`);

    return CONCURRENT_FUNCTION({ name, children }).expression;


    
}*/
/*

        return function (fromSerial)
        {
            const [concurrent, serial] = iterator.next().value;

            return [...concurrent, keys.map(key => toAsync(key, iterator))];
        }


            new Promise(function (resolve, reject)
            {
                if (iterator.waiting !== key)
                    throw Error("Attempted to run the wrong part of a serial test.");

                function step(method, input)
                {
                    const { done, value } = iterator[method](input);

                    if (done || value.name === "start")
                        return resolve();

                    Promise.resolve(value.value)
                        .then(value => step("next", value))
                        .catch(value => step("throw", value));
                }
            });


/*

const i = (async function * x()
{
    console.log(yield)
})();

i.next(10);
i.next(12);
}*/
