const path = process.argv[2];
const lithograph = require("../lithograph");
const run = require("../run");
const { Repeat, Seq } = require("immutable");


(async function ()
{
    const [root, states] = await run(lithograph(process.argv[2]));
    const keyPaths = Seq(states.keys()).toList()
        .sort(function (lhs, rhs)
        {
            const comparisons = lhs.zipWith((lhs, rhs) =>
                lhs === rhs ? 0 : lhs - rhs, rhs);
            const index = comparisons.find(comparison =>
                comparison !== 0);

            return index === undefined ?
                lhs.size - rhs.size :
                comparisons[index];
        });

    for (const keyPath of keyPaths)
    {
        const node = root.getIn(keyPath);
        const state = states.get(keyPath);
        const prefix = Repeat(" ", keyPath.size).join("");
        const duration = state.duration > -1 ? state.duration + "ms" : ""
        const emoji = state.aggregate === 3 ? "✓" : "✕";

        console.log(`${prefix}${emoji} ${node.title} ${duration}`);
    }
})();

function compare()
{
}

[0,1,2,3]
[0,1,4]