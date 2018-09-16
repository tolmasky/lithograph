const t = require("@babel/types");
const { transformFromAst } = require("babel-core");
const plugin = { visitor: { AwaitExpression, TaggedTemplateExpression } };
const options = { plugins: [plugin] };
const valueToExpression = require("./value-to-expression");
const { isArray } = Array;


module.exports = function (statements, callbacks)
{
    const statementArray = isArray(statements) ?
        statements : Array.from(statements);

    return transformFromAst(
        Object.assign(t.program(statementArray), callbacks),
        "",
        options).ast.program.body;
}

function TaggedTemplateExpression (path, state)
{
    const { node: { tag, quasi } } = path;
    const { quasis, expressions } = quasi;
    const isResource = t.isIdentifier(tag) && tag.name === "resource";
    const isStringLiteralArgument =
        quasis.length === 1 && expressions.length === 0;

    if (!isResource || !isStringLiteralArgument)
        return;

    const URL = quasis[0].value.raw;
    const { getResource } = state.file.ast.program;
    const resource = getResource(URL);

    path.replaceWith(valueToExpression(resource));
}

function AwaitExpression (path, state)
{
    const { fromTopLevelAwait } = state.file.ast.program;

    if (!fromTopLevelAwait)
        return;

    if (!t.isProgram(path.getFunctionParent().node))
        return;

    path.replaceWith(fromTopLevelAwait(path.node.argument));
}
