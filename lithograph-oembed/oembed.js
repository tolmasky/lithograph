const { data, union, boolean, string, number, parameterized } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");
const fromTable = require("@lithograph/plugin/from-table");
const { Failure } = require("@lithograph/remark/parse-type");
const Section = require("@lithograph/ast/section");

const Format = union `Format` (
    data `JSON` (),
    data `XML` () );

const OEmbedConfiguration = data `OEmbedConfiguration` (
    formats => Set(Format),
    maxwidths => Set(number) );


module.exports = function OEmbedPlugin(section)
{
    const { preamble, subsections } = section;
    const table = preamble.get(0);
    const configuration = fromTable(OEmbedConfiguration, table);

    if (Failure.is(configuration))
        throw TypeError(configuration.message);

    const { formats, maxwidths } = configuration;
    const transformed = subsections.map(transformCase);

    console.log(configuration);
    //console.log(Section.from(MDList.toArray(list.next.next)));
/*
    const args = fromTable(OEmbedArguments, elements[0]);

    console.log(args);
    console.log(elements);

    return `# A simple test`;*/

    return section;
}


const transformCase = (function ()
{
    const URLtype = URL;
    const URLTestCase = data `URLTestCase` (
        URL => string,
        succeeds => [boolean, true]);

    return function transformCase(section)
    {
        const { preamble } = section;
        const table = preamble.last();

        if (table.type !== "table")
            return section;

        const configuration = fromTable(URLTestCase, table);

        return section;
    }
})();
