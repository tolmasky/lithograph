const { List, Map } = require("immutable");
const { Test } = require("../suite");
const TestPath = require("../test-path");

const t = require("babel-types");
const { parse } = require("@babel/parser");
const transformStatements = require("./transform-statements");
const getTopLevelAwaitReplacement = argument => yield("await", argument);
const valueToExpression = require("./value-to-expression");
const { default: generate } = require("babel-generator");

const construct = require("babel-template");
const template = string =>
    ((template => options => template(options).expression)
    (construct(`(${string})`)))

const { Record } = require("immutable");
const SourceEntry = Record({ path:-1, fragment:-1 }, "SourceEntry");
const Module = require("module");
const { dirname } = require("path");


module.exports = function (root, environment, filename)
{
    const parameters = Object.keys(environment);
    const source = toModuleSource(root, parameters);
    const module = new Module(filename);

    module.filename = filename;
    module.paths = Module._nodeModulePaths(dirname(filename));

    const toGenerator = module._compile(source, filename);

    module.loaded = true;

    return toGenerator(...parameters.map(key => environment[key]));
}

function toModuleSource(root, parameters)
{
    const { fragment } = fromPath(root).get(0);
    const { code, map } = generate(fragment, { sourceMaps: true });
    const mapComment =
        "//# sourceMappingURL=data:application/json;charset=utf-8;base64," +
        Buffer.from(JSON.stringify(map), "utf-8").toString("base64");

    return `return (${parameters}) => (${code});\n${mapComment}`;
}

function fromPath(path, wrap)
{
    const { node, id } = path.data;

    if (node instanceof Test)
        return fromTest(path, wrap || !path.next);

    if (node.metadata.schedule === "Serial")
        return fromSerial(path, wrap);

    return fromConcurrent(path, true);
}

const TEST_TEMPLATE = template(function * ()
{
    return (yield "test")($id, async () => { $statements })
});

function fromTest(path, wrap)
{
    const { data: { node, id } } = path;
    const concatenated = node.children
        .flatMap(parseBlock)
        .toArray();
    const $statements = transformStatements(concatenated,
    {
        getResource: getResource(path, false),
        getTopLevelAwaitReplacement: !wrap && getTopLevelAwaitReplacement
    });
    const fragment = wrap ?
        TEST_TEMPLATE({ $id: t.stringLiteral(id), $statements }) :
        $statements;

    return List.of(SourceEntry({ path, fragment }));
}

const CONCURRENT_TEMPLATE = template(function * ()
{
    return (yield "concurrent")([$children]);
});

function fromConcurrent(path)
{
    const { node } = path.data;
    const children = node.children
        .flatMap((child, index) =>
            fromPath(TestPath.child(path, index, child), true))
        .toArray();

    if (children.length <= 0)
        return List();

    const $children = Array.from(
        children,
        ({ fragment }) => fragment);
    const fragment = CONCURRENT_TEMPLATE({ $children });

    return List.of(SourceEntry({ path, fragment }));
}

const SERIAL_TEMPLATE = template(function * ()
{
    return (yield "serial")(function * ()
    {
        yield $children;
        $statements;
    }());
});

function fromSerial(path, wrap)
{
    const { node } = path.data;
    const children = node.children
        .flatMap((child, index) =>
            fromPath(TestPath.child(path, index, child)));

    if (!wrap)
        return children;

    if (children.size <= 0)
        return List();

    const groups = children.groupBy(({ path }) =>
        path.data.node instanceof Test ? "test" : "suite");
    const tests = groups.get("test", List());

    const serial = tests
        .map(({ path }) => path.data.id)
        .toArray();
    const concurrent = groups.get("suite", List())
        .map(({ path, fragment }) => fragment)
        .toArray();

    const $statements = tests
        .flatMap(({ path: { data: { id } }, fragment }) =>
            [ yield("start", id), ...fragment ])
        .toArray();
    const $children = valueToExpression([concurrent, serial]);
    const fragment = SERIAL_TEMPLATE({ $statements, $children });

    return List.of(SourceEntry({ path, fragment }));
}

function getResource(path, URL)
{
    if (URL === false)
        return URL => getResource(path, URL);

    const { resources } = path.data.node.metadata;

    if (resources.has(URL))
        return resources.get(URL);

    if (!path.parent)
        throw ReferenceError(`Resource "${URL}" is not defined.`);

    return getResource(path.parent, URL);
}

function yield(name, value)
{
    return t.yieldExpression(valueToExpression({ name, value }));
}

function parseBlock({ code, line, path })
{
    const allowAwaitOutsideFunction = true;
    const sourceFilename = path;
    const startLine = line;
    const options = { startLine, allowAwaitOutsideFunction, sourceFilename };

    return parse(code, options).program.body;
}
