const t = require("babel-types");
const { transformFromAst } = require("babel-core");
const plugin = { visitor: { AwaitExpression, TaggedTemplateExpression } };
const options = { plugins: [plugin] };
const valueToExpression = require("./value-to-expression");


module.exports = function (statements, callbacks)
{
    return transformFromAst(
        Object.assign(t.program(statements), callbacks),
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
    const { getTopLevelAwaitReplacement } = state.file.ast.program;

    if (!getTopLevelAwaitReplacement)
        return;

    if (!t.isProgram(path.getFunctionParent().node))
        return;

    path.replaceWith(getTopLevelAwaitReplacement(path.node.argument));
}
