const { program } = require("@babel/template");
const { is, data, union, string, getUnscopedTypename, getKind, parameterized, primitives } = require("@algebraic/type");
const { List, Map, Set } = require("@algebraic/collections");
const { Variable } = require("@lithograph/remark/parse-type");
const t = require("@babel/types");
const toExpression = require("@lithograph/ast/value-to-expression");

const isSetOrList = type => 
    parameterized.is(Set, type) || parameterized.is(List, type);
const append = (path, key) => path ? `${path}.${key}` : key;
const flattened = (type, value, path = "") =>
    isSetOrList(type) ? flattenedCollection(type, value, path) :
    Variable.is(value) ? [[path, t.identifier(value.name)]] :
    getKind(type) === union ? flattenedUnion(type, value, path) :
    getKind(type) === data ? flattenedData(type, value, path) :
    type === primitives.string ? [[path, value]] :
    type === URL ? [[path, `new URL("${value}")`]] :
    [[path, value]];
const flattenedCollection = (type, value, path = "") =>
    [[path, value.toArray()
        .map(value => flattened(parameterized.parameters(type)[0], value, ""))
        .map(value => value[0][1])]];
const flattenedUnion = (type, value, path) =>
    flattened(
        union.components(type)
            .find(type => is(type, value)),
        value,
        path);
const flattenedData = (type, value, path) =>
    type === value ?
        [[path, getUnscopedTypename(value)]] :
        [].concat(...data.fields(type)
            .map(([key, type]) =>
                [append(path, key), type, value[key]])
            .map(([path, type, value]) =>
                flattened(type, value, path)));


module.exports = function (type, templateArguments = false)
{
    if (templateArguments === false) 
        return node => node;

    const toTemplateIdentifier = keyPath =>
        `FIXME_TEMPLATE_${keyPath.replace(/\./g, "_")}`;
    const { default: generate } = require("@babel/generator");

    return function (node)
    {
        const { value: original } = node;

        if (node.type !== "code" ||
            node.meta !== "(templated)" ||
            original.indexOf("{%") === -1)
            return node;

        const entries = flattened(type, templateArguments)
            .map(([path, value]) => [path, toExpression(value)]);
        const syntax = new RegExp(`{%(${entries
            .map(([path]) => path.replace(/\./g, "\\."))
            .join("|")})%}`, "g");
        const replacements = Map(string, Object)
            (entries.map(([key, value]) =>
                [toTemplateIdentifier(key), value]));
        const fixedSyntax = original.replace(syntax,
            (_, name) => toTemplateIdentifier(name)) +
            `\n(()=>(${replacements.keySeq().join(",")}))`;
        const placeholderPattern =
            new RegExp(`^${replacements.keySeq().join("|")}$`);
        const transformed = program(fixedSyntax,
        {
            allowAwaitOutsideFunction: true,
            preserveComments: true,
            placeholderPattern
        })(replacements.toObject());
        const value = generate(transformed).code;

        return { ...node, value };
    }
}


    