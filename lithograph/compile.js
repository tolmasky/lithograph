const { is, data, number, boolean, string, ftype, declare } = require("@algebraic/type");
const { Map, List } = require("@algebraic/collections");
const IndexPath = require("@lithograph/status/index-path");

const fMap = Map(number, ftype);
const ScopeMap = Map(ftype, number);

const Compilation = data `Compilation` (
    scope       => number,
    id          => number,
    f           => ftype,
    fscope      => ftype);

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
        const fragment = fromSuite(suite);
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

        const compilations = toCompilations(toGenerator(...args));
        const functions = fMap(compilations.map(({ id, f }) => [id, f]));

        const scopes = ScopeMap(compilations.map(({ fscope, scope }) => [fscope, scope]));
        const findShallowestScope = toFindShallowestScope(scopes);

        return { functions, findShallowestScope };
    }
})();

function fromExecutable(executable)
{
    return is(Test, executable) ?
        fromTest(executable) :
        fromSuite(executable);
}

function fromSuite(suite)
{
    return suite.children.size === 1 ?
        fromExecutable(suite.children.get(0)) :
        suite.mode === Suite.Mode.Serial ?
            fromSerial(suite, 0) :
            fromConcurrent(suite);
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

    return function fromTest(test)
    {
        const { block: { id }, fragments } = test;
        const $statements = inlineStatementsFromTest(test, false);

        return template({ $id: toExpression(id), $statements });
    }
})();

const inlineStatementsFromTest = (function ()
{
    const { yieldExpression } = require("@babel/types");
    const fromTopLevelAwait = argument => yieldExpression(argument);
    const transformStatements = require("./compile/transform-statements");

    return function inlineStatementsFromTest(test, toYield)
    {
        const { block: { id }, fragments } = test;
        const concatenated = fragments.flatMap(parseFragment);
        
        return transformStatements(concatenated,
        {
            getResource: URL => getResource(test, URL),
            fromTopLevelAwait: toYield && fromTopLevelAwait
        });
    }
})();


const fromSerial = (function ()
{
    const SERIAL_TEMPLATE = ftemplate(function * ()
    {
        return (yield "serial")(async function PIZZA()
        {
            await this($children);
            $statements;
        });
    });

    return function fromSerial(suite, index)
    {
        const { children } = suite;
        const child = children.get(index);
        const isTest = is(Test, child);
    
        const scope = suite.block.id;
        const next =  index < children.size - 1 ?
            [fromSerial(suite, index + 1)] :
            [];
        const current = isTest ?
            toExpression(child.block.id) :
            fromExecutable(child);
    
        const $statements = isTest ?
            inlineStatementsFromTest(child, false) : [];
        const $children = toExpression([scope, current, ...next]);
    
        return SERIAL_TEMPLATE({ $statements, $children });
    }
})();

const fromConcurrent = (function ()
{
    const template = ftemplate(function * ()
        { return (yield "concurrent")($children); });

    return function fromConcurrent({ children })
    {
        const $children = toExpression(children.map(fromExecutable));

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
console.log(scopes);
        const index = backtrace.findIndex(callsite =>
            scopes.get(callsite.getFunction()) !== void(0));

if (index>=0)
console.log(index, backtrace[index].getFunction());//backtrace.map(callsite => callsite.getFunctionName()));
else{
console.log(index, backtrace.map(callsite => callsite.getFunction()))
console.log(index, backtrace.map(callsite => callsite.getFunctionName()))}
console.log(Error().stack);
console.log(scopes.keySeq().toList());
 console.log(scopes.keySeq().toList().map(x => x === backtrace[4].getFunction()));
        return index === -1 ?
            false :
            scopes.get(backtrace[index].getFunction());
    }
}











