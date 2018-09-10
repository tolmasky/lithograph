const { Seq, List, Map } = require("immutable");
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
console.log(source);
//process.exit(1);
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
    return (yield "test")($id, $range, async () => { $statements });
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
    const fragment = !wrap ?
        $statements :
        TEST_TEMPLATE(
        {
            $range: getSourceRange($statements),
            $id: t.stringLiteral(id),
            $statements
        });

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
    return (yield "serial")($id, $range, $serial, function * ()
    {
        yield $concurrent;
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

    // The flattened tests will be merged into one set of statements in a
    // single function so that they can share scope.
    const tests = groups.get("test", List());
    const $serial = valueToExpression(tests.map(test => test.path.data.id).toArray());
    const $statements = tests
        .flatMap(({ path: { data: { id } }, fragment }) =>
            [ yield("start", id), ...fragment ])
        .toArray();

    // We know we can make this distinction because all serial children have
    // been flattened, so any suite children must be concurrent.
    const suites = groups.get("suite", List());
    const $concurrent = valueToExpression(suites.map(suite => suite.fragment).toArray());

    // The scope range is the union of all the the ranges of statements.
    const $range = getSourceRange($statements);
    const $id = t.stringLiteral(path.data.id);
    const fragment = SERIAL_TEMPLATE(
        { $id, $serial, $range, $statements, $concurrent });

    return List.of(SourceEntry({ path, fragment }));
}

function getSourceRange(statements)
{
    const statementSeq = Seq(statements);
    const hasLocation = statement => !!statement.loc;
    const noPosition = { line:-1, column:-1 };
    const noStatement = { loc: { start: noPosition, end: noPosition } };

    const { loc: { start } } = statementSeq.find(hasLocation) || noStatement;
    const { loc: { end } } = statementSeq.findLast(hasLocation) || noStatement;

    return valueToExpression({ start, end });
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
