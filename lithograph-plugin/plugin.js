const { data, string, parameterized } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Section = require("@lithograph/ast/section");

const fromTable = require("./from-table");
const { Failure } = require("@lithograph/remark/parse-type");
const Configuration = data `Configuration` (plugin => string);
const NodeList = List(Object);


module.exports = function transform(section, module)
{
    const { preamble, subsections } = section;

    if (preamble.size <= 0)
        return section;

    const [table, ...rest] = preamble;

    if (table.type !== "table")
        return section;

    const configuration = fromTable(Configuration, table, { headers: true });

    if (parameterized.belongs(Failure, configuration))
        return section;

    const plugin = module.require(configuration.plugin);
    const withoutConfiguration =
        Section({ ...section, preamble: NodeList(rest) });

    return transform(plugin(withoutConfiguration), module);
}
