const { data, union, number } = require("@algebraic/type");
const { List, Stack } = require("@algebraic/collections");

const TableColumn = Object;
const isNotEmpty = tableColumn => tableColumn.children.length > 0;

const Entry = data `Entry` (
    key     => TableColumn,
    depth   => number,
    entries => [List(Item), List(Item)()] );
const Item = union `Item` (Entry, TableColumn);
const adopt = (key, item, { [key]: list, ...rest }) =>
    Entry({ ...rest, [key]: list.push(item) });

const Start = Stack(Entry)([Entry({ depth:-1, key:{ } })]);


module.exports = function toEntries({ table, headers = false })
{
    const tableRows = headers ?
        table.children : table.children.slice(1);
    const stack = tableRows.reduce(function (stack, tableRow)
    {
        const tableColumns = List(TableColumn)(tableRow.children);
        const depth = tableColumns.findIndex(isNotEmpty);
        const trimmed = tableColumns.skip(depth).takeWhile(isNotEmpty);

        return trimmed.reduce((stack, tableColumn, index) =>
            index !== trimmed.size - 1 ?
                stack.push(Entry({ depth: depth + index, key: tableColumn })) :
                stack.pop().push(adopt("entries", tableColumn, stack.peek())),
            collapse(depth, stack));
    }, Start);

    return collapse(0, stack).peek().entries;
}

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
