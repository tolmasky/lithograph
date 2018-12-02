const { is, data, union, number, boolean, parameterized, ftype } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const { Test, Suite, ResourceMap } = require("@lithograph/ast");
const toExpression = require("@lithograph/ast/value-to-expression");

const fMap = Map(number, ftype);
const ScopeMap = Map(ftype, number);
Error.stackTraceLimit = 1000;
const Compilation = data `Compilation` (
    scope       => number,
    id          => number,
    f           => ftype,
    fscope      => ftype);

const Path = parameterized (T =>
    data `Path <${T}>` (
        parent => T === Test ?
            Path(Suite) :
            [union `` (Path(Suite), Path.Root), Path.Root],
        T === Test ? test => T : suite => T ) );
Path.Root = data `Path.Root` ();
Path.child = (index, parent) =>
    (executable => is(Test, executable) ?
        Path(Test)({ test: executable, parent }) :
        Path(Suite)({ suite: executable, parent }))
    (parent.suite.children.get(index));

const ResourcePath = union `ResourcePath` (
    data `Child` (
        resources   => ResourceMap,
        parent      => ResourcePath ),
    data `Root` ( ) );


function printSuite(suite, nest = "")
{
    console.log(nest + suite.block.title + " (" + suite.block.id + ") " + suite.mode);

    for (const child of suite.children)
        if (is(Test, child))
            console.log(nest + "    " + child.block.title  + " (" + child.block.id + ") ");
        else
            printSuite(child, nest + "    ");
}

module.exports = (function()
{
    const Module = require("module");
    const { dirname } = require("path");
    const generate = require("babel-generator").default;

    return function (environment, suite, filename)
    {
        const fragment = fromSuite(Path(Suite)({ suite }));
        const { code, map } = generate(fragment, { sourceMaps: true });
        const mapComment =
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64," +
            Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
        const parameters = Object.keys(environment);
        const source = `return (${parameters}) => (${code});\n${mapComment}`;
        const module = new Module(filename);

        module.filename = filename;
        module.paths = Module._nodeModulePaths(dirname(filename));
        module.loaded = true;

        const toGenerator = module._compile(source, filename);
        const args = parameters.map(key => environment[key]);

        const compilations = toCompilations(toGenerator(...args));
        const functions = fMap(compilations.map(({ id, f }) => [id, f]));

        const scopes = ScopeMap(compilations.map(({ fscope, scope }) => [fscope, scope]));
        const findShallowestScope = toFindShallowestScope(scopes);

        return { functions, findShallowestScope };
    }
})();

function fromExecutable(executablePath)
{
    return is(Path(Test), executablePath) ?
        fromTest(executablePath) :
        fromSuite(executablePath);
}

function fromSuite(suitePath)
{
    const { suite } = suitePath;

    return suite.children.size === 1 ?
        fromExecutable(Path.child(0, suitePath)) :
        suite.mode === Suite.Mode.Serial ?
            fromSerial(suitePath, 0) :
            fromConcurrent(suitePath);
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
    const template = ftemplate(function * ()
    {
        return (yield "test")($id, async () => { $statements });
    });

    return function fromTest(testPath)
    {
        const $id = toExpression(testPath.test.block.id);
        const $statements = inlineStatementsFromTest(testPath);

        return template({ $id, $statements });
    }
})();

const inlineStatementsFromTest = (function ()
{
    const { yieldExpression } = require("@babel/types");
    const fromTopLevelAwait = argument => yieldExpression(argument);
    const transformStatements = require("./compile/transform-statements");

    return function inlineStatementsFromTest(testPath)
    {
        const { fragments } = testPath.test;
        const concatenated = fragments.flatMap(parseFragment);
        const getResource = URL => getResource(testPath, URL);

        return transformStatements(concatenated, { getResource });
    }
})();


const fromSerial = (function ()
{
    const SERIAL_TEMPLATE = ftemplate(function * ()
    {
        return (yield "serial")(async function ()
        {
            await this($children);
            $statements;
        });
    });

    return function fromSerial(suitePath, index)
    {
        const childPath = Path.child(index, suitePath);
        const isTestPath = is(Path(Test), childPath);

        const { suite: { block, children } } = suitePath;
        const scope = block.id;
        const next = index < children.size - 1 ?
            [fromSerial(suitePath, index + 1)] :
            [];
        const current = isTestPath ?
            toExpression(childPath.test.block.id) :
            fromExecutable(childPath);

        const $statements = isTestPath ?
            inlineStatementsFromTest(childPath) : [];
        const $children = toExpression([scope, current, ...next]);

        return SERIAL_TEMPLATE({ $statements, $children });
    }
})();

const fromConcurrent = (function ()
{
    const template = ftemplate(function * ()
        { return (yield "concurrent")($children); });

    return function fromConcurrent(suitePath)
    {
        const { suite: { children } } = suitePath;
        const paths = children.map((_, index) => Path.child(index, suitePath));
        const $children = toExpression(paths.map(fromExecutable));

        return template({ $children });
    }
})();

function getResource(executablePath, URL)
{
    if (executablePath === Path.Root)
        throw ReferenceError(`Resource "${URL}" is not defined.`);

    const { resources } = executablePath.executable;

    if (resources.has(URL))
        return resources.get(URL);

    return getResource(executablePath.parent, URL);
}

const parseFragment = (function ()
{
    const { parse } = require("@babel/parser");
    const allowAwaitOutsideFunction = true;

    return function parseFragment({ start, filename, value })
    {
        try
        {
            // Add one because of the triple-ticks.
            const startLine = start.line + 1;
            const sourceFilename = filename;
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

function toCompilations(generator)
{
    const iterator = generator();
    const type = iterator.next().value;

    return iterator.next(builders[type]).value;
}

const builders =
{
    concurrent: children =>
        [].concat(...children.map(toCompilations)),

    serial(fInspect)
    {
        const fData = { };
        const fPromise = fInspect.apply(function ([scope, current, next])
        {
            fData.current = current;
            fData.next = next;
            fData.scope = scope;

            return new Promise(resolve => fData.resolve = resolve);
        });
        const { current, next, scope, resolve } = fData;
        const f = () => (resolve(), fPromise);
        const pairs = typeof current === "number" ?
            [Compilation({ id: current, scope, fscope:fInspect, f })] :
            toCompilations(current);

        return next ? pairs.concat(toCompilations(next)) : pairs;
    },

    test: (id, f) => [Compilation({ id, scope: id, f, fscope:f })]
}

function toFindShallowestScope(scopes)
{
    return function findShallowestScope()
    {
        const { stackTraceLimit } = Error;
        Error.stackTraceLimit = Infinity;
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
