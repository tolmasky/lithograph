const { Map, List } = require("immutable");
const NodePath = require("../lithograph-node/path");
const { Test, Suite, fromMarkdown } = require("../lithograph-node");
const toExpression = require("./compile/value-to-expression");


module.exports = (function()
{
    const Module = require("module");
    const { dirname } = require("path");
    const generate = require("babel-generator").default;

    return function (parameters, node)
    {
        const fragment = fromPath(new NodePath(node));
        const { code, map } = generate(fragment, { sourceMaps: true });
        const mapComment =
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64," +
            Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
        const source = `return (${parameters}) => (${code});\n${mapComment}`;
        const { filename } = node.source;
        const module = new Module(filename);
    
        module.filename = filename;
        module.paths = Module._nodeModulePaths(dirname(filename));
        module.loaded = true;
    
        return module._compile(source, filename);
    }
})();

function fromPath(path, wrap)
{
    return path.node instanceof Test ?
        fromTest(path, wrap) :
        path.node.mode === Suite.Serial ?
            fromSerial(path, 0) : 
            fromConcurrent(path);
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

    return function fromTest(path, wrap)
    {
        const { metadata: { id }, fragments } = path.node;
        const concatenated = fragments.flatMap(parseBlock);
        const $statements = transformStatements(concatenated,
        {
            getResource: URL => getResource(path, URL),
            fromTopLevelAwait: !wrap && fromTopLevelAwait
        });

        return !wrap ?
            $statements :
            template({ $id: toExpression(id), $statements });
    }
})();

function fromSerial(path, index)
{
    const { children } = path.node;
    const child = new NodePath(children.get(index), path);

    if (index === children.size - 1)
        return fromPath(child, true);

    const isTest = child.node instanceof Test;
    const $statements = isTest ?
        fromTest(child, false) : [];

    const next = fromSerial(path, index + 1);
    const current = isTest ?
        toExpression(child.node.metadata.id) :
        fromPath(child);
    const $children = toExpression([current, next]);

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

    return function fromConcurrent(path)
    {
        const $children = toExpression(
            path.node.children.map((_, index) =>
                fromPath(path.child(index), true)));

        return template({ $children });
    }
})();

function getResource(path, URL)
{
    const { resources } = path.metadata;

    if (resources.has(URL))
        return resources.get(URL);

    if (!path.parent)
        throw ReferenceError(`Resource "${URL}" is not defined.`);

    return getResource(path.parent, URL);
}

const parseBlock = (function ()
{
    const { parse } = require("@babel/parser");
    const allowAwaitOutsideFunction = true;

    return function parseBlock({ source, value })
    {
        const startLine = source.start.line;
        const sourceFilename = source.filename;
        const options =
            { startLine, allowAwaitOutsideFunction, sourceFilename };

        return parse(value, options).program.body;
    }
})();

/*
function * ()
{
    
}


# Blah (Serial)

## X (Serial)
    
    TEST -> BEFORE

    CONTENT ->
        
        ONE
        
        TWO

## SOMETHING


# Blah (Serial)

## X (Concurrent)

BEFORE

### ONE
--
### TWO
---

## Y

test

[statements], [statements], [statements]*/