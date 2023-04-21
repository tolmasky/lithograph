#!/usr/bin/env -S clf

const { join } = require("path");

const fail = require("@reified/fail");

const { is } = require("@algebraic/type");
const Result = require("@lithograph/status/result");

const main = () => true;
//const main = require("./main");
console.log("here!");
const glob = require("fast-glob");
const toJUnitXML = require("./to-junit-xml");
console.log("here!");
const { resolve } = require("path");
const moment = require("moment");


module.exports = async function (
{
    concurrency = require("os").cpus().length, // Max number of test files running at the same time (Default: CPU cores)
    output, // Output file destination
    headless = true, // Whether to run Chrome in headless mode (Default: true)
    browserLogs = false, // Whether to display browser logs.
    requires = [], // Adds a file to automatically require in the test environment.
}, ...patterns)
{
    const implicitPatterns = patterns.length > 0 ? patterns : ["**/*.test.md"];
    const paths = Array
        .from(new Set(implicitPatterns.flatMap(pattern => glob.sync(pattern))))
        .map(path => resolve(path));

    console.log("THE PATTERNS ARE: ", patterns);
    console.log("THE PATHS ARE: ", paths);
/*
    if (paths.length <= 0)
        return fail(
            `\nNo files to process, perhaps there is a typo in your pattern:` +
            `\n${implicitPatterns.map(pattern => `   ${pattern}`).join("\n")}\n`);
*/
    const title = `${moment().format("YYYY-MM-DD-HH.mm.ss")}`;
    const start = Date.now();

    const result = await main(paths,
    {
        concurrency,
        headless,
        requires: requires.map(path => resolve(path)),
        title
    });

    const time = Date.now() - start;

    const destination =
        join(output || `/tmp/lithograph-results/${title}`, "junit.xml");

    console.log("Writing file... " + destination);
    toJUnitXML(destination, result, time);

    console.log(`Test Time: ${time}ms`);
    console.log("Total Time (including writing results): " + (Date.now() - start) + "ms");

    //console.log(require("fs").readFileSync(filename, "utf-8"));

    if (is(Result.Failure, result))
        return fail("TESTS FAILED TO PASS")

    console.log("ALL ENABLED TESTS PASSED");
}
