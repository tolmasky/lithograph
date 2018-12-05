const { is, data, union, number, boolean, parameterized, ftype } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const { Test, Suite, ResourceMap } = require("@lithograph/ast");
const toExpression = require("@lithograph/ast/value-to-expression");


const Composite = data `Composite` (
    ids         => List(number),
    expression  => Object);
const CompositeList = List(Composite);

const fMap = Map(number, ftype);
const ScopeMap = Map(ftype, number);
Error.stackTraceLimit = 1000;
const Compilation2 = data `Compilation` (
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
    const generate = require("@babel/generator").default;

    return function (environment, suite, filename)
    {
        const { ids, expression } = fromSuite(Path(Suite)({ suite }));
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
/*printSuite(suite);
toGenerator(...args).map((keys, f) => console.log("FOR " + keys + "\n" + f));
console.log(toFunctions(...toGenerator(...args)[0]))
const fs = toFunctions(...toGenerator(...args)[0]);
(async function ()
{
    var i = 0;
    for (const id of Object.keys(fs))
    {
        await fs[id]();
        console.log((i++) + "after");
    }
})();*/
console.log(toGenerator(...args) +"");
console.log(code);
        const getFunction = toGetFunction(ids, toGenerator(...args));
        return { getFunction, findShallowestScope:()=>false };
/*
        const compilations = toCompilations(toGenerator(...args));
        const functions = fMap(compilations.map(({ id, f }) => [id, f]));

        const scopes = ScopeMap(compilations.map(({ fscope, scope }) => [fscope, scope]));
        const findShallowestScope = toFindShallowestScope(scopes);

        return { functions, findShallowestScope };*/
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
console.log(fromConcurrent+"");
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

const t = require("@babel/types");
const yield = (argument, delegate) =>
    t.yieldExpression(toExpression(argument), delegate);
const tAsyncGenerator = 
    (tAsyncGenerator => ($title, $statements) =>
        tAsyncGenerator({ $statements, $title: t.stringLiteral($title) }))
    (ftemplate(async function * () { $title; $statements }));

const fromTest = (function ()
{
    const tAsyncFunction = ftemplate(async function () { $title; $statements });

    return function fromTest(testPath)
    {
        const { title, id } = testPath.test.block;
        const $title = t.stringLiteral(title);
        const $statements = inlineStatementsFromTest(testPath);
        const expression = tAsyncFunction({ $title, $statements });
    
        return Composite({ ids:List(number)([id]), expression });
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
        const beginStatement = t.expressionStatement(yield({ begin: id }));

        return transformed;//[beginStatement, ...transformed];
    }
})();


const fromSerial = (function ()
{
    const t = require("@babel/types");
    const yield = (argument, delegate) =>
        t.yieldExpression(toExpression(argument), delegate);
    const await = argument =>
        t.awaitExpression(t.parenthesizedExpression(toExpression(argument)));
    const tAsyncGenerator = ftemplate(async function * () { $title; $statements });
    const tscope = $f => yield(t.callExpression(yield({ scope: $f }), []), true);
    const testReduce = function (ids, chunks, path)
    {
        const { id } = path.test.block;

        ids.push(id);
        chunks.push([t.expressionStatement(yield({ begin: id })), ...inlineStatementsFromTest(path)]);
    };
    const suiteReduce = function (ids, chunks, childPath)
    {
        const { suite } = childPath;
        const { mode, inserted } = suite;

        if (inserted)
        {
            testReduce(ids, chunks, Path.child(0, childPath));
            suiteReduce(ids, chunks, Path.child(1, childPath));
        }
        else
        {            
            const nested = fromExecutable(childPath);
    
            if (mode === Suite.Mode.Serial)
            {
                ids.push(...nested.ids);
                chunks.push([t.expressionStatement(tscope(nested.expression))]);
            }
            else
            {
                
            console.log(nested);
                ids.push(...nested.ids);
                chunks.push([t.expressionStatement(nested.expression)]);
            }
        }
    }

    return function fromSerial(suitePath, index)
    {
        const { suite } = suitePath;
        const [ids, chunks] = suite.children
            .map((_, index) => Path.child(index, suitePath))
            .reduce(function ([ids, chunks], childPath)
            {
                if (is(Path(Test), childPath))
                    testReduce(ids, chunks, childPath);

                else
                    suiteReduce(ids, chunks, childPath);

                return [ids, chunks];
            }, [[], []]);

        const $title = t.stringLiteral(suite.block.title);
        const $statements = [].concat(...chunks);
        const expression = tAsyncGenerator({ $title, $statements });

        return Composite({ ids: List(number)(ids), expression });
    }
})();



const fromConcurrent = (function ()
{
    const tFunction = ftemplate(function () { $title; return $definitions; });

    return function fromConcurrent(suitePath)
    {
        const { block: { title }, children } = suitePath.suite;
        const [ids, definitions] = children
            .map((_, index) => Path.child(index, suitePath))
            .map(fromExecutable)
            .reduce(([ids, definitions], definition) =>
            [
                ids.concat(definition.ids),
                definitions.concat([[definition.ids, definition.expression]])
            ], [List(number)(), []]);
        const $definitions = toExpression(definitions);
        const $title = t.stringLiteral(title);
        const expression = tFunction({ $title, $definitions });

        return Composite({ ids, expression });
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

function toGetter(functions)
{
    return function (id)
    {
        return functions[id];
    }
}

const toGetFunction = (function ()
{
    const { getPrototypeOf } = Object;
    const constructor = object =>
        getPrototypeOf(object).constructor;
    const AsyncFunction = constructor((async () => { }));     
    const AsyncGeneratorFunction = constructor((async function * () { }));

    return (ids, definition) => 
        definition instanceof AsyncGeneratorFunction ?
            toSerialGetFunction(ids, definition) :
        definition instanceof AsyncFunction ?
            id => definition :
            toConcurrentGetFunction(ids, definition);
})();

const resolvable = (fs = []) =>
    [new Promise((...args) => fs = args), ...fs];

function toConcurrentGetFunction(ids, f)
{
    const functions = f()
        .map(([ids, g]) => [ids, toGetFunction(ids, g)])
        .reduce((functions, [ids, f]) =>
            ids.reduce((functions, id) =>
                (functions[id] = f, functions),
                functions),
            { });

    return id => functions[id](id);
}

function toSerialGetFunction(ids, f)
{
console.log("MADE " + ids);
    const None = { };
    const state = { active:None, next:ids[0] };console.log(state);
    const generator = f();
    const started = generator.next();

    const resolvable = (fs = []) =>
        [new Promise((...args) => fs = args), ...fs];
    const observers = toObject(ids.map(id => [id, resolvable()]));
started.then(() => console.log("INITIATED " + ids));
    const functions = toObject(ids.map(id => [id, () => started.then(() => (console.log("STARTING " + 6,step(id))))]));

    return id => functions[id];

    function step(id, [promise, resolve] = observers[id])
    {console.log("MY " + ids + " " + state.active + " " + state.next);
        //if (state.active !== None || state.next !== id)
        //    throw Error(`Attempting to call test ${id} before it is ready.`);

        state.active = id;
        state.next = None;

        generator.next().then(function finish({ value, done })
        {console.log("NO THAR");
            if (value && value.scope)
                return generator.next(value.scope).then(finish);

            if (value && value.define)
            {
                const last = functions[6];
                value.define
                    .map(pair => toFunctions(...pair))
                    .map(replacements => Object.keys(replacements)
                        .map(key => functions[key] = replacements[key]));
                console.log("-->" + (functions[6] === last), );// + " " + (toFunctions(...value.define[0])[6] === last));
//console.log("DONE " + value.active + " " + done, value.define
//                    .map(pair => toFunctions(...pair)));
            }
            state.active = None;
            !done && (state.next = value.begin);
            resolve();
        });

        return promise;
    };
}

function toObject(pairs)
{console.log(pairs);
    return pairs.reduce((object, [id, f]) => (object[id] = f, object), { });
}

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
