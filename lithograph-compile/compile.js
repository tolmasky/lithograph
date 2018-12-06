const t = require("@babel/types");
const { is, data, union, number, boolean, parameterized, ftype } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const { Test, Suite, ResourceMap } = require("@lithograph/ast");
const toExpression = require("@lithograph/ast/value-to-expression");

const fMap = Map(number, ftype);
const ScopeMap = Map(ftype, number);
Error.stackTraceLimit = 1000;

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
console.log("RESULT ", toFunctions(toGenerator(...args)));
        const functions = fMap(toFunctions(toGenerator(...args)));

//        const scopes = ScopeMap(compilations.map(({ fscope, scope }) => [fscope, scope]));
//        const findShallowestScope = toFindShallowestScope(scopes);

        return { functions, findShallowestScope:()=>false };
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
    const tscope = $f => yield(t.callExpression(yield({ scope: $f }), []), true);
    const TEMPLATE = ftemplate(async function * () { this($id, $prefix); $statements });

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
        return TEMPLATE({ $id, $prefix, $statements });
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

const toFunctions = (function ()
{
    const { getPrototypeOf } = Object;
    const constructor = object =>
        getPrototypeOf(object).constructor;
    const AsyncGeneratorFunction = constructor((async function * () { }));

    return function toFunctions(definition)
    {
        return typeof definition !== "function" ?
            [definition] :
            definition instanceof AsyncGeneratorFunction ?
                toPartialFunction(definition) :
                toAvailableFunctions(definition);
    }
})();

function toAvailableFunctions(definition)
{
    return [].concat(...definition().map(toFunctions));
}

function toPartialFunction(definition)
{//console.log("PARTIAL!");
    const immediate = [];
    const generator = definition
        .apply((...args) => immediate.push(...args));
    const started = generator.next();
    const [id, definitions] = immediate; //FIXME: clean this up.
    const functions = [].concat(...definitions.map(toFunctions));
//console.log(id, definitions, typeof id);
    if (typeof id !== "number")
        return functions;

    const step = async function ()
    {
        var next = await generator.next();
        const functions = [];

        while (typeof next.value === "function")
        {
            functions.push(...toFunctions(next.value));
            next = await generator.next();
        }

        return typeof next.value === "number" ?
            fMap([[next.value, step], ...functions]) :
            fMap(functions);
    };
//console.log(functions);
    return [[id, () => started.then(step)], ...functions];
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
