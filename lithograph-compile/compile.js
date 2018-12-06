const t = require("@babel/types");
const { is, data, union, number, boolean, parameterized, ftype } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const { Test, Suite, ResourceMap } = require("@lithograph/ast");
const toExpression = require("@lithograph/ast/value-to-expression");

const fMap = Map(number, Function);
const ScopeMap = Map(Function, number);
const Context = data `Context` (
    functions   => [fMap, fMap()],
    scopes      => [ScopeMap, ScopeMap()] );

Context.fromPairs = function ContextFromPairs(pairs)
{
    const grouped = List(Object)(pairs)
        .groupBy(pair => typeof pair[0] === "number");
    const functions = fMap(grouped.get(true));
    const scopes = ScopeMap(grouped.get(false));

    return Context({ functions, scopes });
}

Context.merge = (lhs, rhs) => Context(
{
    functions: lhs.functions.concat(rhs.functions),
    scopes: lhs.scopes.concat(rhs.scopes)
});

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


module.exports = (function()
{
    const Module = require("module");
    const { dirname } = require("path");
    const generate = require("@babel/generator").default;

    return function (environment, suite, filename)
    {
        const expression = fromSuite(Path(Suite)({ suite }));
        const { code, map } = generate(toExpression(expression), { sourceMaps: true });
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

console.log("-->"+code);
console.log("RESULT ", toPairs(toGenerator(...args)));
        const context = Context.fromPairs(toPairs(toGenerator(...args)));

//        const scopes = ScopeMap(compilations.map(({ fscope, scope }) => [fscope, scope]));
//        const findShallowestScope = toFindShallowestScope(scopes);

        return { context, findShallowestScope:()=>false };
    }
})();

module.exports.compile = module.exports;
module.exports.Context = Context;

function fromExecutable(executablePath)
{
    return is(Path(Test), executablePath) ?
        fromTest(executablePath) :
        fromSuite(executablePath);
}

function fromSuite(suitePath)
{
    const { suite } = suitePath;

    return suite.mode === Suite.Mode.Serial ?
        fromSerial(suitePath) :
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
    const tAsyncFunction = ftemplate(async function () { $title; $statements });

    return function fromTest(testPath)
    {
        const { title, id } = testPath.test.block;
        const $title = t.stringLiteral(title);
        const $statements = inlineStatementsFromTest(testPath);
        const expression = tAsyncFunction({ $title, $statements });

        return [[id, expression]];
    }
})();

const inlineStatementsFromTest = (function ()
{
    const transformStatements = require("./transform-statements");

    return function inlineStatementsFromTest(testPath)
    {
        const { fragments, block: { id } } = testPath.test;
        const concatenated = fragments.flatMap(parseFragment);
        const getResource = URL => getResource(testPath, URL);
        const transformed = transformStatements(concatenated, { getResource });

        return transformed;
    }
})();

const fromSerial = (function ()
{
    const yield = (argument, delegate) =>
        t.expressionStatement(t.yieldExpression(toExpression(argument), delegate));
    const tAsyncGenerator = ftemplate(async function * ()
        { $title; this($scope, $id, $prefix); $statements });

    return function fromSerial(suitePath, index)
    {
        const { suite } = suitePath;
        const isTestPath = is(Path(Test));
        const paths = suite.children
            .map((_, index) => Path.child(index, suitePath))
            .flatMap(path => isTestPath(path) || !path.suite.inserted ?
                [path] :
                [Path.child(0, path), Path.child(1, path)]);
        const firstTestPath = paths.findIndex(isTestPath);
        const $prefix = toExpression(paths
            .take(firstTestPath)
            .flatMap(fromExecutable));
        const $statements = paths
            .skip(firstTestPath)
            .flatMap(path => isTestPath(path) ?
                [yield(path.test.block.id), ...inlineStatementsFromTest(path)] :
                [yield(fromExecutable(path))]).toArray();
        const $id = toExpression(
            firstTestPath < paths.size ?
            paths.get(firstTestPath).test.block.id : void 0);
        const $scope = toExpression(suite.block.id);
        const $title = t.stringLiteral(suite.block.title);

        return tAsyncGenerator({ $title, $scope, $id, $prefix, $statements });
    };
})();

const fromConcurrent = (function ()
{
    const recurse = ftemplate(() => $children);

    return function fromConcurrent(suitePath)
    {
        const children = [].concat(...suitePath.suite.children
            .map((_, index) => Path.child(index, suitePath))
            .map(fromExecutable));

        return recurse({ $children: toExpression(children) });
    };
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

const toPairs = (function ()
{
    const { getPrototypeOf } = Object;
    const constructor = object => getPrototypeOf(object).constructor;
    const AsyncGeneratorFunction = constructor((async function * () { }));

    return function toPairs(definition)
    {
        return typeof definition !== "function" ?
            [definition, [definition[1], definition[0]]] :
            definition instanceof AsyncGeneratorFunction ?
                toPartialFunction(definition) :
                toAvailableFunctions(definition);
    }
})();

function toAvailableFunctions(definition)
{
    return [].concat(...definition().map(toPairs));
}

function toPartialFunction(definition)
{
    // FIXME: Make this inaccessible? Or maybe piggyback off of
    // (typeof undefined)._magic()
    const immediate = [];
    const generator = definition.call((...args) => immediate.push(...args));
    const started = generator.next();
    const [id, first, definitions] = immediate;

    const scope = [definition, id];
    const pairs = [].concat(...definitions.map(toPairs));
//console.log(id, definitions, typeof id);
    if (typeof first !== "number")
        return [...functions, scope];

    const step = async function ()
    {
        var next = await generator.next();
        const pairs = [];

        while (typeof next.value === "function")
        {
            pairs.push(...toPairs(next.value));
            next = await generator.next();
        }

        return Context.fromPairs(
            typeof next.value === "number" ?
                [[next.value, step], ...pairs] :
                pairs);
    };

    return [[first, () => started.then(step)], scope, ...pairs];
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

function printSuite(suite, nest = "")
{
    console.log(nest + suite.block.title + " (" + suite.block.id + ") " + suite.mode);

    for (const child of suite.children)
        if (is(Test, child))
            console.log(nest + "    " + child.block.title  + " (" + child.block.id + ") ");
        else
            printSuite(child, nest + "    ");
}
