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


module.exports = function (path, result, time)
{
    spawnSync("mkdir", ["-p", dirname(path)]);

    const fd = open(path, "wx");

    write(fd, `<?xml version = "1.0" encoding = "UTF-8" ?>\n`);

    tag(fd, 0, "testsuites",
        { id: result.suite.block.title, tests:0, failures:0, time },
        () => result.children.map(result => toXML(fd, result, 1)));

    close(fd);
}

function toXML(fd, result, tabs)
{
    const toChildrenXML = () => result.children
        .map((result, index) => toXML(fd, result, tabs + 1));

    if (is(Result.Suite, result))
    {
        const { suite: { block } } = result;

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
                { message: result.reason.message || "", type: "FATAL" },
                () => write(fd, escape(result.reason.stack || "") + "\n"));
    const time = !is(JUnitSkipped, result) ?
        result.duration.end - result.duration.start :
        0;

    return tag(fd, tabs, "testcase",
        { name: title, id, time }, children);
}

function tag(fd, tabs, name, attributes = { }, children)
{
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
