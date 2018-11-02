const { is, data, number, string, ftype, declare } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");

const fMap = Map(number, ftype);
const Pair = declare({ is: () => true });
const PairList = List(declare({ is: () => true }));

const { Test, Suite, NodePath, fromMarkdown } = require("@lithograph/ast");
const toExpression = require("./compile/value-to-expression");


module.exports = (function()
{
    const Module = require("module");
    const { dirname } = require("path");
    const generate = require("babel-generator").default;

    return function (environment, suite)
    {
        const fragment = fromPath(NodePath.Suite.Root({ suite }));
        const { code, map } = generate(fragment, { sourceMaps: true });
        const mapComment =
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64," +
            Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
        const parameters = Object.keys(environment);
        const source = `return (${parameters}) => (${code});\n${mapComment}`;
        const { filename } = suite.block.source;
        const module = new Module(filename);

        module.filename = filename;
        module.paths = Module._nodeModulePaths(dirname(filename));
        module.loaded = true;

        const toGenerator = module._compile(source, filename);
        const args = parameters.map(key => environment[key]);

        return fMap(toPairs(toGenerator(...args)));
    }
})();

function fromPath(nodePath, wrap)
{
    return is(NodePath.Test, nodePath) ?
        fromTest(nodePath, wrap) :
        nodePath.suite.mode === Suite.Mode.Serial ?
            fromSerial(nodePath, 0) :
            fromConcurrent(nodePath);
}

const ftemplate = (function ()
{
    const template = require("@babel/template").default;
    const options = { placeholderPattern: /^\$[a-z]+$/ };

    return string =>
        ((template => options => template(options).expression)
        (template(`(${string})`, options)))
})();

const fromTest = (function ()
{
    const { yieldExpression } = require("@babel/types");
    const fromTopLevelAwait = argument => yieldExpression(argument);
    const transformStatements = require("./compile/transform-statements");
    const template = ftemplate(function * ()
    {
        return (yield "test")($id, async () => { $statements });
    });

    return function fromTest(testPath, wrap)
    {
        const { block: { id }, fragments } = testPath.test;
        const concatenated = fragments.flatMap(parseFragment);
        const $statements = transformStatements(concatenated,
        {
            getResource: URL => getResource(testPath, URL),
            fromTopLevelAwait: !wrap && fromTopLevelAwait
        });

        return !wrap ?
            $statements :
            template({ $id: toExpression(id), $statements });
    }
})();

function fromSerial(suitePath, index)
{
    const { children } = suitePath.suite;
    const childPath = NodePath.Suite.child(index, suitePath);

    if (index === children.size - 1)
        return fromPath(childPath, true);

    const isTestPath = is(NodePath.Test, childPath);
    const $statements = isTestPath ?
        fromTest(childPath, false) : [];

    const next = fromSerial(suitePath, index + 1);
    const current = isTestPath ?
        toExpression(childPath.test.block.id) :
        fromPath(childPath, false);
    const $children = toExpression([next, current]);

    return SERIAL_TEMPLATE({ $statements, $children });
}

const SERIAL_TEMPLATE = ftemplate(function * ()
{
    return (yield "serial")(function * ()
    {
        yield $children;
        $statements;
    }());
});

const fromConcurrent = (function ()
{
    const template = ftemplate(function * ()
        { return (yield "concurrent")($children); });

    return function fromConcurrent(suitePath)
    {
        const $children = toExpression(
            NodePath.Suite.children(suitePath)
                .map(nodePath => fromPath(nodePath, true)));

        return template({ $children });
    }
})();

function getResource(nodePath, URL)
{
    const { resources } = nodePath.metadata;

    if (resources.has(URL))
        return resources.get(URL);

    if (!path.parent)
        throw ReferenceError(`Resource "${URL}" is not defined.`);

    return getResource(nodePath.parent, URL);
}

const parseFragment = (function ()
{
    const { parse } = require("@babel/parser");
    const allowAwaitOutsideFunction = true;

    return function parseFragment({ source, value })
    {
        const startLine = source.start.line;
        const sourceFilename = source.filename;
        const options =
            { startLine, allowAwaitOutsideFunction, sourceFilename };

        return parse(value, options).program.body;
    }
})();

function toPairs(generator)
{
    const iterator = generator();
    const type = iterator.next().value;

    return iterator.next(builders[type]).value;
}

const builders =
{
    concurrent: children =>
        [].concat(...children.map(toPairs)),

    serial(iterator)
    {
        const children = iterator.next().value;
        const next = toPairs(children[0]);

        if (children.length === 1)
            return next;

        const current = children[1];
        const pairs = typeof current === "number" ?
            [PairList.of(current, toAsync(iterator))] :
            toPairs(current);

        return pairs.concat(next);
    },

    test: (key, f) => [PairList.of(key, f)]
}

function toAsync(iterator)
{
    return () => new Promise(function (resolve, reject)
    {
        (function step(method, input)
        {
            try
            {
                const { done, value } = iterator[method](input);

                if (done)
                    return resolve();

                Promise.resolve(value)
                    .then(value => step("next", value))
                    .catch(value => step("throw", value));
            }
            catch (error)
            {
                reject(error);
            }
        })("next", void 0);
    });
}
