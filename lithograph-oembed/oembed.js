const { data, union, boolean, string, number, parameterized } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");
const fromTable = require("@lithograph/plugin/from-table");
const { Failure, Variable } = require("@lithograph/remark/parse-type");
const Section = require("@lithograph/ast/section");
console.log(Variable);
const Format = union `Format` (
    data `JSON` (),
    data `XML` () );

const Specification = data `Specification` (
    providerName    => string,
    providerURL     => URL,
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


const transformCase = (function ()
{


    return function transformCase(section, specification)
    {
        const URLVariable = Variable(string);
        const x = specification;
        const URLTestCase = data `URLTestCase` (
            URL             => URLVariable,
            specification   => [Specification, x]);
    
        const { preamble } = section;
        const table = preamble.last();

        if (table.type !== "table")
            return section;

        const testCaseArguments = fromTable(URLTestCase, table);

        if (Failure.is(testCaseArguments))
            throw TypeError(testCaseArguments.message);

        const child = Section.fromMarkdown(`${__dirname}/test-cases/json-response-implemented.md`, URLTestCase, testCaseArguments);
        const { subsections } = section;

        return Section({ ...section, subsections: subsections.push(child) });
    }
})();













