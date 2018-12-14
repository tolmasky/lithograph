const { is } = require("@algebraic/type");
const Result = require("@lithograph/status/result");

const main = require("../main");

const glob = require("fast-glob");
const toJUnitXML = require("../to-junit-xml");

const { resolve } = require("path");
const moment = require("moment");

const uuid = require("uuid").v4;
const { tstat, mkdirp } = require("sf-fs");

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

    if (paths.length <= 0)
        return fail(
            `\nNo files to process, perhaps there is a typo in your pattern:` +
            `\n${patterns.map(pattern => `   ${pattern}`).join("\n")}\n`);

    options.requires = options.require.map(path => resolve(path));
    options.title = `${moment().format("YYYY-MM-DD-HH.mm.ss")}`;
    options.workspace = tmp();

    const start = Date.now();
    const result = await main(paths, options);
    const time = Date.now() - start;

    const output = options.output || `/tmp/lithograph-results/${options.title}`;
    const filename = `${output}/junit.xml`;

    console.log("Writing file... " + filename);
    toJUnitXML(filename, result, time);

    console.log("Test Time: " + time + "ms");
    console.log("Total Time (including writing results): " + (Date.now() - start) + "ms");

    //console.log(require("fs").readFileSync(filename, "utf-8"));

    if (is(Result.Failure, result))
        return fail("TESTS FAILED TO PASS")

    console.log("ALL ENABLED TESTS PASSED");
})();


function fail(...args)
{
    console.error(...args);
    process.exit(1);
}

function tmp(extname)
{
    const path = `/tmp/lithograph/${uuid()}${extname || ""}`;

    return tstat(path) ? tmp() : (mkdirp(path), path);
}
