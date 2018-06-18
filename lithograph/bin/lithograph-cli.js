const run = require("../run");
const { List } = require("immutable");

const { readFileSync } = require("fs");
const glob = require("fast-glob");
const { Repeat, Seq } = require("immutable");

const Node = require("../node");


const options = require("commander")
    .version(require("../package").version)
    .option("-c, --concurrency [concurrency]",
        "Max number of test files running at the same time (Default: CPU cores)",
        require("os").cpus().length)
    .option("--no-headless")
    .option("--browser-logs")
    .parse(process.argv);
const patterns = options.args.length <= 0 ? ["**/*.test.md"] : options.args;

(async function ()
{
    const paths = Array.from(new Set(
        [].concat(...patterns
            .map(pattern => glob.sync(pattern)))));
    const children = List(paths
        .map(path => [path, readFileSync(path, "utf-8")])
        .map(([path, contents]) => Node.parse(path, contents)));
    const root = Node({ children });

    const start = Date.now();
    const [_, states] = await run(root, options);
    const duration = Date.now() - start;

    const keyPaths = Seq(states.keys()).toList()
        .sort((lhs, rhs) => lhs
            .zipWith((lhs, rhs) => lhs === rhs ? 0 : lhs - rhs, rhs)
            .find(comparison => comparison !== 0) ||
            lhs.size - rhs.size);

    console.log("Total Time: " + duration + "ms");

    for (const keyPath of keyPaths)
    {
        if (keyPath.size === 0)
            continue;

        const node = root.getIn(keyPath);
        const state = states.get(keyPath);
        const prefix = Repeat(" ", keyPath.size).join("");
        const duration = state.duration > -1 ? `(${state.duration}ms)` : ""
        const emoji = state.aggregate === 3 ? "✓" : "✕";

        console.log(`${prefix}${emoji} ${node.title} ${duration}`);
    }
    
    if (states.get(List()).aggregate === 2)
        process.exit(1);
})();
