const main = require("../main");
const { List } = require("immutable");

const glob = require("fast-glob");
const { Repeat, Seq } = require("immutable");

const toJUnitXML = require("../to-junit-xml");

const { resolve } = require("path");
const moment = require("moment");

const options = require("commander")
    .version(require("../package").version)
    .option("-c, --concurrency [concurrency]",
        "Max number of test files running at the same time (Default: CPU cores)",
        require("os").cpus().length)
    .option("-o, --output [output]",
        "")
    .option("--no-headless")
    .option("--browser-logs")
    .option("-r, --require [path]",
        "A package to automatically require in the test environment.",
        (v, m) => (m.push(v), m), [])
    .parse(process.argv);

const patterns = options.args.length <= 0 ? ["**/*.test.md"] : options.args;

(async function ()
{
    const paths = Array.from(new Set(
        [].concat(...patterns.map(pattern => glob.sync(pattern)))))
        .map(path => resolve(path));

    options.requires = options.require.map(path => resolve(path));

    const start = Date.now();
    const results = await main(paths, options);
    const id = `${moment().format("YYYY-MM-DD-HH.mm.ss")}`;
    const output = options.output || `/tmp/lithograph-results/${id}`;
    const filename = `${output}/junit.xml`;
    const time = Date.now() - start;

    console.log("Writing file... " + filename);
    toJUnitXML(filename, id, time, results);

    console.log("Test Time: " + time + "ms");
    console.log("Total Time (including writing results): " + (Date.now() - start) + "ms");

    console.log(require("fs").readFileSync(filename, "utf-8"));

    process.exit(1);
/*
    if (states.get(List()).aggregate === 2)
        process.exit(1);
*/
})();


function print(node, tabs = 0)
{
    if (tabs === 0)
        console.log(node.title);
    else
    {
        const prefix = Repeat(" ", tabs).join("");
        const { duration, outcome } = node.report;
        const emoji =
            outcome.type === "skipped" ? "-" :
            outcome.type === "success" ? "✓" : "✕";
        const post = outcome.type === "skipped" ? "(skipped)" : `(${duration}ms)`;

        console.log(`${prefix}${emoji} ${node.title} ${post}`);
    }

    if (node.children)
        return node.children.map(node => print(node, tabs + 1))
}
