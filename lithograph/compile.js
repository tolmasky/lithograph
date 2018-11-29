const { is, data, number, string, ftype, declare } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");

const fMap = Map(number, ftype);
const Pair = declare({ is: () => true });
const PairList = List(declare({ is: () => true }));

const { Test, Suite } = require("@lithograph/ast");
const NodePath = require("./compile/node-path");
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
        const filename = suite.block.ranges.keySeq().get(0);
        const module = new Module(filename);

        module.filename = filename;
        module.paths = Module._nodeModulePaths(dirname(filename));
        module.loaded = true;

        const toGenerator = module._compile(source, filename);
        const args = parameters.map(key => environment[key]);

        const functions = fMap(toPairs(toGenerator(...args)));
        const findShallowestScope = toFindShallowestScope(functions);

        return { functions, findShallowestScope };
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
    const { resources } = NodePath.block(nodePath);

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

    return function parseFragment({ range, value })
    {
        try
        {
            // Add one because of the triple-ticks.
            const startLine = range.start.line + 1;
            const sourceFilename = range.filename;
            const options =
                { startLine, allowAwaitOutsideFunction, sourceFilename };

            return parse(value, options).program.body;
        }
        catch (error)
        {
            if (!(error instanceof SyntaxError))
                throw error;

            // Unfortunately, @babel/parse doesn't take into account
            // the `startLine`, so we have to do it ourselves.
            // https://github.com/babel/babel/issues/9015
            const { line: unmapped, column } = error.loc;
            const { filename, start } = range;
            const line = unmapped + start.line;
            const message = error.message.replace(/\d+(?=:\d+\)$)/, line);

            const snippet = value.split("\n")[unmapped - 1];
            const marker = snippet
                .split("\n")
                .slice(0, column - 1)
                .map(ch => /s/.test(ch) ? ch : " ")
                .join("") + "^";
            const stack =
                `${filename}:${line}:${column}\n` +
                `${snippet}\n` +
                `${marker}\n` +
                `SyntaxError: ${message}\n` +
                `    at ${filename}:${line}:${column}`;
            const mapped = SyntaxError(message, filename, line);

            throw Object.assign(mapped, { stack });
        }
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

    test: (key, f) => [PairList.of(key, Object.assign(f, {SCOPE:key}))]
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

function toFindShallowestScope(functions)
{
    const scopes = new WeakMap();

    functions.map((f, id) => scopes.set(f, id));

    return function findShallowestScope()
    {
        const prepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_, backtrace) => backtrace;

        const backtrace = Error().stack;

        Error.prepareStackTrace = prepareStackTrace;

        const index = backtrace.findIndex(callsite =>
            scopes.get(callsite.getFunction()) !== void(0));

        return index === -1 ?
            false :
            scopes.get(backtrace[index].getFunction());
    }
}











