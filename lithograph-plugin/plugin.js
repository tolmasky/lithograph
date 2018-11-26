const { data, string, parameterized } = require("@algebraic/type");
const MDList = require("@lithograph/remark/md-list");

const fromTable = require("./from-table");
const { Failure } = require("@lithograph/remark/parse-type");
const Configuration = data `Configuration` (plugin => string);


module.exports = function _(heading, next, module)
{
    if (next === MDList.End)
        return { heading, next };

    const table = next.node;

    if (table.type !== "table")
        return { heading, next };

    const configuration = fromTable(Configuration, table, { headers: true });

    if (parameterized.belongs(Failure, configuration))
        return { heading, next };

    const depth = heading.depth;
    const [children, rest] = MDList.takeWhile(
        node => node.type !== "heading" || node.depth > depth,
        next.next);
    const withHeading = MDList({ node: heading, next: children });
    const plugin = module.require(configuration.plugin);
    const transformed = MDList.concat(plugin(withHeading), rest);

    if (transformed === MDList.End ||
        transformed.node.type !== "heading" ||
        transformed.node.depth > heading.depth)
        return { heading, next: transformed.next };

    return { heading: transformed.node, next: transformed.next };
}


