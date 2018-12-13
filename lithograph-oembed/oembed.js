const { data, union, boolean, string, number, parameterized } = require("@algebraic/type");
const { Map, Set } = require("@algebraic/collections");
const fromTable = require("@lithograph/plugin/from-table");
const { Failure, Variable } = require("@lithograph/remark/parse-type");
const Section = require("@lithograph/ast/section");

const Format = union `Format` (
    data `JSON` (),
    data `XML` () );

const Specification = data `Specification` (
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

const transformCase = (function ()
{
    var i = 0;
    const testCases = Map(string, Function)
    ({
        "default-format-response":
            tc => true,
        "json-response-implemented":
            tc => tc.specification.formats.has(Format.JSON),
        "xml-response-unimplemented":
            tc => !tc.specification.formats.has(Format.XML),
        "rich":
            tc => tc.type === "rich"
    }).mapKeys(name => `${__dirname}/test-cases/${name}.lit.md`);

    return function transformCase(section, specification)
    {
        const x = specification;

        const URLTestCase = data ([`URLTestCase${i++}`]) (
            dirname         => [string, __dirname],
            URL             => URLVariable,
            width           => number,
            type            => string, // FIXME: Make enum.
            onReady         => Variable(Function),
            specification   => [Specification, x]);

        const { preamble } = section;
        const table = preamble.last();

        if (table.type !== "table")
            return section;

        const testCaseArguments = fromTable(URLTestCase, table);

        if (Failure.is(testCaseArguments))
            throw TypeError(testCaseArguments.message);

        const children = testCases
            .filter(predicate => predicate(testCaseArguments))
            .map((_, filename) => Section.fromMarkdown(
                filename,
                URLTestCase,
                testCaseArguments));
        const subsections = section.subsections.concat(children);

        return Section({ ...section, subsections });
    }
})();













