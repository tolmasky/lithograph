const { data, union, boolean, string, number, parameterized } = require("@algebraic/type");
const { Map, Set } = require("@algebraic/collections");
const fromTable = require("@lithograph/plugin/from-table");
const { Failure, Variable } = require("@lithograph/remark/parse-type");
const Section = require("@lithograph/ast/section");
console.log(Variable);
const Format = union `Format` (
    data `JSON` (),
    data `XML` () );

const Specification = data `Specification` (
    APIEndpoint     => string,
    providerName    => string,
    providerURL     => string,
    formats         => Set(Format),
    maxwidths       => Set(number) );


module.exports = function OEmbedPlugin(section)
{
    const { preamble, subsections } = section;
    const table = preamble.get(0);
    const specification = fromTable(Specification, table);

    if (Failure.is(specification))
        throw TypeError(specification.message);

    const { formats, maxwidths } = specification;
    const transformed = subsections.map(subsection =>
        transformCase(subsection, specification));

    console.log(specification);

    return Section({ ...section, subsections: transformed });
}

var i=0;
const transformCase = (function ()
{
    const testCases = Map(string, string)
        (["json-response-implemented"]
            .map(name =>
                [name, `${__dirname}/test-cases/${name}.lit.md`]));

    return function transformCase(section, specification)
    {
        const x = specification;
        const URLTestCase = data `URLTestCase${i++}` (
            URL             => Variable(string),
            width           => number,
            type            => string, // FIXME: Make enum.
            specification   => [Specification, x]);
    
        const { preamble } = section;
        const table = preamble.last();

        if (table.type !== "table")
            return section;

        const testCaseArguments = fromTable(URLTestCase, table);

        if (Failure.is(testCaseArguments))
            throw TypeError(testCaseArguments.message);

        const child = Section.fromMarkdown(
            testCases.get("json-response-implemented"),
            URLTestCase,
            testCaseArguments);
        const { subsections } = section;

        return Section({ ...section, subsections: subsections.push(child) });
    }
})();













