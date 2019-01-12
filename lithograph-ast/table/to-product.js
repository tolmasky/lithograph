const { is, data, union, string } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const getInnerText = require("@lithograph/remark/get-inner-text");

const Entry = data `Entry` (
    key     => string,
    value   => Item );

const Product = data `Product` (
    header  => TableColumn,
    entries => List(Entry) );

const TableColumn = Object;
const Item = union `Item` (TableColumn, Product);
const EmptyList = List(Entry)();

const nestedRegExp = /(\s*└\s*)?(.+)$/;


module.exports = function toEntries({ table, headers = false })
{
    const tableRows = headers ?
        table.children : table.children.slice(1);
    const entries = tableRows.reduce(function (entries, tableRow)
    {
        const [keyColumn, value] = tableRow.children;console.log("HI");
        const [, nested, key] = getInnerText(keyColumn).match(nestedRegExp);
        const entry = Entry({ key, value });

        return !nested ? 
            entries.push(entry) :
            entries.pop().push((({ key, value }) => Entry(
            {
                key,
                value: is(Product, value) ?
                    Product({ ...value, entries: value.entries.push(entry) }) :
                    Product({ header: value, entries:List(Entry)([entry]) })
            }))(entries.last()));
    }, EmptyList);

    return Product({ header:{}, entries });
}

module.exports.Product = Product;
