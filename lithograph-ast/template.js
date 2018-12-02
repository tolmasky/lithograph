const { program } = require("@babel/template");
const { data, string, getKind, parameterized, primitives } = require("@algebraic/type");
const { List, Map, Set } = require("@algebraic/collections");
const { Variable } = require("@lithograph/remark/parse-type");

const isSetOrList = type => 
    parameterized.is(Set, type) || parameterized.is(List, type);
const append = (path, key) => path ? `${path}.${key}` : key;
const flattened = (type, value, path = "") =>
    isSetOrList(type) ? [] :
        //value.toArray().map(key => [path, value]) :
    Variable.is(value) ? [[path, value.name]] :
    getKind(type) === data ? flattenedData(type, value, path) :
    type === primitives.string ? [[path, `"${value}"`]] :
    type === URL ? [[path, `new URL("${value}")`]] :
    [[path, value]];
const flattenedData = (type, value, path) =>
    [].concat(...data.fields(type)
        .map(([key, type]) =>
            [append(path, key), type, value[key]])
        .map(([path, type, value]) =>
            flattened(type, value, path)));


module.exports = function (type, templateArguments = false)
{
    if (templateArguments === false) 
        return node => node;

    const toIdentifier = keyPath =>
        `FIXME_TEMPLATE_${keyPath.replace(/\./g, "_")}`;
    const { default: generate } = require("@babel/generator");

    return function (node)
    {
        const { value: original } = node;

        if (node.type !== "code" ||
            node.meta !== "(templated)" ||
            original.indexOf("{%") === -1)
            return node;

        const entries = flattened(type, templateArguments);
        const syntax = new RegExp(`{%(${entries
            .map(([path]) => path.replace(/\./g, "\\."))
            .join("|")})%}`, "g");console.log(syntax);
        const replacements = Map(string, Object)
            (entries.map(([key, value]) =>
                [toIdentifier(key), value]));
        const fixedSyntax = original.replace(syntax,
            (_, name) => toIdentifier(name)) +
            `\n(()=>(${replacements.keySeq().join(",")}))`;
        const placeholderPattern =
            new RegExp(`^${replacements.keySeq().join("|")}$`);console.log(replacements.toObject());
        const transformed = program(fixedSyntax,
        {
            allowAwaitOutsideFunction: true,
            preserveComments: true,
            placeholderPattern
        })(replacements.toObject());console.log(transformed);
        const value = generate(transformed).code;

        return { ...node, value };
    }
}


    