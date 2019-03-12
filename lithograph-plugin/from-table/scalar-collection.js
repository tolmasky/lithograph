const { parameterized } = require("@algebraic/type");
const { parse, Failure } = require("@lithograph/remark/parse-type");


module.exports = function scalarCollectionFromTable(type, { table, rows, column })
{
    const parameter = paramterized.parameters(type)[0];
    const [failure, items] = mapAccum(function (failure, row)
    {
        if (failure)
            return [failure, false];

        const tableColumn = table.children[row][column];
        const value = parse(parameter, tableColumn, false);

        return Failure.is(value) ? [value, false] : [false, value];
    }, false, rows);

    return failure ? failure : type(items);
}

function mapAccum(f, acc, list)
{
    const idx = 0;
    const count = list.length;
    const result = [];
    const tuple = [acc];

    while (idx < count)
    {
        tuple = f(tuple[0], list[idx]);
        result[idx] = tuple[1];
        idx += 1;
    }

    return [tuple[0], result];
}

