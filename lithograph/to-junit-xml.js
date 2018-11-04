const { dirname } = require("path");
const { spawnSync } = require("child_process");
const { is, union } = require("@algebraic/type");
const { Result } = require("@lithograph/status");
const JUnitSkipped = union `JUnitSkipped` (Result.Skipped, Result.Omitted);

const { openSync: open, writeSync: write, closeSync: close } = require("fs");
const escape = (map =>
    (regexp =>
        string => string.replace(regexp, item => map[item]))
    (new RegExp(`[${Object.keys(map).join("")}]`, "g")))
    ({ ">": "&gt;", "<": "&lt;", "'": "&apos;", "\"": "&quot;", "&": "&amp;" });


module.exports = function (path, results)
{
    spawnSync("mkdir", ["-p", dirname(path)]);

    const fd = open(path, "wx");

    write(fd, `<?xml version = "1.0" encoding = "UTF-8" ?>\n`);

    for (const result of results)
        toXML(fd, result);

    close(fd);
}

function toXML(fd, result, tabs = 0)
{
    const toChildrenXML = () => result.children
        .map((result, index) => toXML(fd, result, tabs + 1));

    if (tabs === 0)
    {
        const id = "0";
        const name = result.suite.block.title;
        const tests = "0";
        const failures = "0";
        const time = "0";

        return tag(fd, tabs, "testsuites",
            { id, name, tests, failures, time },
            toChildrenXML);
    }

    if (is(Result.Suite, result))
    {
        const { suite: { block } } = result;
console.log("HERE FOR " + block.title);
        return tag(fd, tabs, "testsuite",
            { name: block.title, id: block.id }, toChildrenXML);
    }

    const { test } = result;
    const { block: { title, id } } = test;
    const children = is(Result.Success.Test, result) ?
        null :
        is (JUnitSkipped, result) ?
            () => tag(fd, tabs + 1, "skipped") :
            () => tag(fd, tabs + 1, "failure",
                { message: reason.message || "", type: "FATAL" },
                () => write(fd, escape(result.reason.stack || "") + "\n"));

    return tag(fd, tabs, "testcase",
        { name: title, id }, children);
}

function tag(fd, tabs, name, attributes = { }, children)
{console.log(attributes);
console.log(Object
        .keys(attributes));
    const attributesString = Object
        .keys(attributes)
        .map(key => `${key} = "${escape(attributes[key] + "")}"`)
        .join(" ");
    const spaces = " ".repeat(tabs * 4);

    write(fd, `${spaces}<${name} ${attributesString}`);

    if (!children)
        return write(fd, "/>\n");

    write(fd, ">\n");

    children();

    write(fd, `${spaces}</${name}>\n`);
}
