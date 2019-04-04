const { data, union, boolean, string, number, parameterized } = require("@algebraic/type");
const { Map, Set } = require("@algebraic/collections");
const fromTable = require("@lithograph/plugin/from-table");
const tabelTo = require("@lithograph/ast/table/to");
const { Failure, Variable } = require("@lithograph/remark/parse-type");
const Section = require("@lithograph/ast/section");
const getType = object => Object.getPrototypeOf(object).constructor;

const Format = union `Format` (
    data `JSON` (),
    data `XML` () );

const Specification = data `Specification` (
//    URLSchemes      => Set(string),
    APIEndpoint     => string,
    providerName    => string,
    providerURL     => string,
    formats         => [Set(Format), Set(Format)([Format.JSON, Format.XML])],
    defaultFormat   => Format,
    maxwidths       => Set(number) );

module.exports = function OEmbedPlugin(section)
{
    const { preamble, subsections } = section;
    const table = preamble.get(0);
    const specification = fromTable(Specification, table);

    if (Failure.is(specification))
        throw TypeError(specification.message);

    return transformCases(section, specification);
}

function transformCases(section, specification)
{
    const subsections = section.subsections.map(function (subsection)
    {
        const transformed = transformCase(subsection, specification);

        return transformed === subsection ?
            transformCases(subsection, specification) :
            transformed;
    });

    return Section({ ...section, subsections });
}

const URLVariable = union `URLVariable` (
    Variable(string),
    string);

const TemplateArguments = parameterized  (T =>
    data `TemplateArguments<${T}>` (
        dirname         => [string, __dirname],
        specification   => Specification,
        ...data.fields(T).map(([name, type]) => new Function(
            "__type", `return ${name} => __type`)(type))));
const toTemplateArguments = (specification, testArguments) =>
    TemplateArguments(getType(testArguments))
        ({ ...testArguments, specification });

const TestCase = union `TestCase` (
    data `FoundURL` (
        URL             => URLVariable,
        width           => number,
        type            => string, // FIXME: Make enum.
        onReady         => Variable(Function)),
    data `NotFoundURL` (
        notFoundURL     => URLVariable ));

const testCases = Map(Object, Map(string, Function))(
[
    toTestCasePair(TestCase.FoundURL,
    {
        "missing-url-response": tc => true,
        "default-format-response": tc => true,
        "json-response-implemented":
            tc => tc.specification.formats.has(Format.JSON),
        "xml-response-unimplemented":
            tc => !tc.specification.formats.has(Format.XML),
        "rich": tc => tc.type === "rich"
    }),
    toTestCasePair(TestCase.NotFoundURL,
    {
        "not-found-url": tc => true
    })
]);

function transformCase(section, specification)
{
    const { preamble } = section;
    const table = preamble.last();

    if (table.type !== "table")
        return section;

    const testCaseArguments = tabelTo(TestCase, { table });

    if (Failure.is(testCaseArguments))
        throw TypeError(testCaseArguments.message);

    const type = getType(testCaseArguments);
    const templateArguments =
        toTemplateArguments(specification, testCaseArguments);
    const children = testCases.get(type)(templateArguments);
    const subsections = section.subsections.concat(children);

    return Section({ ...section, subsections });
}

function toTestCasePair(type, tests)
{
    const testCases = Map(string, Function)(Object.entries(tests))
        .mapKeys(name => `${__dirname}/test-cases/${name}.lit.md`);

    return [type, function toTestCases(templateArguments)
    {
        return testCases
            .filter(predicate => predicate(templateArguments))
            .map((_, filename) => Section.fromMarkdown(
                filename,
                getType(templateArguments),
                templateArguments));
    }];
}

/*
const OEmbed = data `OEmbed` (
    validateURL     => Function,
    APIEndpoint     => string,
    providerName    => string,
    providerURL     => string,
    formats         => Set(Format),
    defaultFormat   => Format,
    maxwidths       => Set(number) );

const toOEmbed = (function ()
{
    const Route = require("route-parser");
    const toRoute = URL => URL.split("/")
        .map((pc, index) => pc === "*" ? `:${index}` : pc)
        .join("/");
    const toValidateURL = schemes =>
        (routes => URL =>
            routes.some(route => route.match(URL)))
        (schemes.toList().map(toRoute));

    return ({ URLSchemes, ...rest }) =>
        OEmbed({ ...rest, validateURL: toValidateURL(URLSchemes) });
})();

*/










