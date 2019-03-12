const { is, data, union, number } = require("@algebraic/type");
const { List, Stack } = require("@algebraic/collections");
const getInnerText = require("@lithograph/remark/get-inner-text");

const TableColumn = Object;
const isNotEmpty = tableColumn => tableColumn.children.length > 0;

const Entry = data `Entry` (
    key     => TableColumn,
    value   => Item );

const Product = data `Product` (
    header  => TableColumn,
    entries => List(Entry) );

const Item = union `Item` (TableColumn, Product);
const nestedRegExp = /\s+└(.*)/g

module.exports = function toPairs({ table, headers = false })
{
    const tableRows = headers ?
        table.children : table.children.slice(1);
    return tableRows.reduce(function (entries, tableRow)
    {
        const [keyColumn, value] = tableRow.children;
        const [, nested, key] = getInnerText(keyColumn);
        const entry = Entry({ key, value });

        return nested ? 
            entries.push(entry) :
            entries.pop().push((last => is(Product, last) ?
                Product({ ...last, entries: last.entries.push(entry) }) :
                Product({ header: last, entries:List(Entry)([entry]) }))
                (entries.last()));
    }, List(Entry)());
}

module.exports.Product = Product;

function collapse(depth, stack)
{
    const shallower = entry => depth > entry.depth;
    const count = stack.findIndex(shallower) + 1;
    const remaining = stack.skip(count);
    const collapsed = stack.take(count)
        .reduce((child, parent) =>
            adopt("entries", child, parent));

    return remaining.push(collapsed);
}
