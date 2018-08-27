const syscall = require("./plugins/syscall");
const t = require("babel-types");
const { parse } = require("babylon");
const { transformFromAst } = require("babel-core");
const { default: generate } = require("babel-generator");
const { Map } = require("../lithograph/node_modules/immutable");
const plugins =
[
    require("./plugins/skip-functions"),
    require("./plugins/hoists"),
    require("./plugins/await-to-yield"),
    require("./plugins/declarations-to-yield")
];

function union(lhs, rhs)
{
    const union = new Set(lhs);

    for (const item of rhs)
        union.add(item);

    return union;
}

(function _(blocks)
{
    const { tdz, vars, functions, body } = blocks
        .map(({ code }) => `(async function () { ${code} })`)
        .map(code => transformFromAst(parse(code), code, { plugins }))
        .reduce(function (accumulator, { metadata, ast })
        {
            const { declarations } = metadata;
            const tdz = union(accumulator.tdz, declarations.tdz);
            const vars = declarations.vars.reduce((vars, [key, f]) =>
                vars.set(key, f || vars.get(key)), accumulator.vars);
            const body = accumulator.body.concat(
                ast.program.body[0].expression.body.body);

            return { tdz, vars, body };
        }, { tdz: new Set(), vars: Map(), body:[] });

    const tdzExpression = syscall("tdz",
        { keys: Array.from(tdz) });
    const varExpressions = Array.from(vars.entries())
        .map(([key, init]) => 
            syscall("declare", { kind:"var", keys:[key], init }));
    const functionExpression = t.functionExpression(null, [],
        t.blockStatement(
        [
            t.expressionStatement(tdzExpression),
            ...varExpressions.map(expression =>
                t.expressionStatement(expression)),
            ...body
        ]));

    functionExpression.generator = true;

    const program =
        t.program([t.expressionStatement(functionExpression)]);

    console.log(generate(program).code);
  
//    console.log(generate(tdzExpression).code);
//    console.log(generate(varsExpression).code);
//    console.log(code);

})([{code:`
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
    for(const x of []) { }`},
{
code: `function x()
{
}`
}]);
