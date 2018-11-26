const { data, union, number } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");
const fromTable = require("@lithograph/plugin/from-table");

const Format = union `Format` (
    data `JSON` (),
    data `XML` () );

const OEmbedArguments = data `OEmbedArguments` (
    supportedFormats => Set(Format),
    maxwidths => Set(number),
    supportedURLs => Set(URL) );



module.exports = function (elements)
{
    const args = fromTable(OEmbedArguments, elements[0]);

    console.log(args);
    console.log(elements);

    return `# A simple test`;
}
