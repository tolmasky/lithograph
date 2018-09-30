const { dirname } = require("path");
const { spawnSync } = require("child_process");
const { Suite, Test } = require("@lithograph/ast");
const { Failure, Success, Skipped, Omitted } = require("@lithograph/status");

const { List } = require("immutable");

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

    for (const { statuses, root } of results)
        toXML(fd, root, statuses);

    close(fd);
}

function toXML(fd, node, statuses, tabs = 0)
{
    const toChildrenXML = () => node.children
        .map((node, index) => toXML(fd, node, tabs + 1));

    if (tabs === 0)
    {
        const id = "0";
        const name = node.metadata.title;
        const tests = "0";
        const failures = "0";
        const time = "0";

        return tag(fd, tabs, "testsuites",
            { id, name, tests, failures, time },
            toChildrenXML);
    }

    if (node instanceof Suite)
        return tag(fd, tabs, "testsuite",
            { name: node.metadata.title }, toChildrenXML);

    const { metadata: { title, id } } = node;
    const result = statuses.get(id);console.log("RESULT", result);
    const children = Success.is(result) ?
        null :
        Skipped.is(result) ?
            () => tag(fd, tabs + 1, "skipped") :
            () => tag(fd, tabs + 1, "failure",
                { message: reason.message || "", type: "FATAL" },
                () => write(fd, escape(result.reason.stack || "") + "\n"));

    return tag(fd, tabs, "testcase",
        { name: title }, children);
}

function tag(fd, tabs, name, attributes = { }, children)
{console.log(attributes);
    const attributesString = Object
        .keys(attributes)
        .map(key => `${key} = "${escape(attributes[key])}"`)
        .join(" ");
    const spaces = " ".repeat(tabs * 4);

    write(fd, `${spaces}<${name} ${attributesString}`);

    if (!children)
        return write(fd, "/>\n");

    write(fd, ">\n");

    children();

    write(fd, `${spaces}</${name}>\n`);
}
