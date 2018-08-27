const { tdz, declare } = require("./plugins/syscall");
const t = require("babel-types");
const { parse } = require("babylon");
const { transform, transformFromAst } = require("babel-core");
const { default: generate } = require("babel-generator");
const { Map } = require("../lithograph/node_modules/immutable");
const plugins =
[
    require("./plugins/skip-functions"),
    require("./plugins/hoists"),
    require("./plugins/await-to-yield"),
    require("./plugins/declarations-to-yield")
];

module.exports = function toGeneratorFunction(blocks)
{
    const code = blocks.map(block => block.code).join("\n");
    const wrapped = `(async function() { ${code} })`;
    const { metadata, ast } = transform(wrapped, { plugins });
    const { declarations } = metadata;

    const tdzExpression = tdz({ keys: Array.from(declarations.tdz) });

    const vars = declarations.vars.reduce((vars, [key, f]) =>
        vars.set(key, f || vars.get(key)), Map());
    const varsExpression = declare(
    {
        kind: "var",
        pairs: Array.from(vars.entries())
    });

    const body = ast.program.body[0].expression.body.body;
    const functionExpression = t.functionExpression(null, [],
        t.blockStatement(
        [
            t.expressionStatement(tdzExpression),
            t.expressionStatement(varsExpression),
            ...body
        ]));

    functionExpression.generator = true;

    const program =
        t.program([t.expressionStatement(functionExpression)]);

    return generate(program).code;
}

/*

([{code:`
    const y = 10;
    const { aa, bn } = 20;
    var x = 20;
    var x;
    const { a: { b } } = 20;
    await x;
    await (async function () { await x; })();
    {
        var i = 13;
        const u = 20;
    }
    for(const x of []) { }
    const [a=await 7]=10;`},
{
code: `function x()
{
}`
}]);*/
