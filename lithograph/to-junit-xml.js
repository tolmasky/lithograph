const { dirname } = require("path");
const { spawnSync } = require("child_process");

const { List } = require("immutable");

const { openSync: open, writeSync: write_, closeSync: close } = require("fs");
const write = (fd, s) => (console.log(s), write_(fd, s));
const escape = (map =>
    (regexp =>
        string => string.replace(regexp, item => map[item]))
    (new RegExp(`[${Object.keys(map).join("")}]`, "g")))
    ({ ">": "&gt;", "<": "&lt;", "'": "&apos;", "\"": "&quot;", "&": "&amp;" });


module.exports = function (path, node)
{
    spawnSync("mkdir", ["-p", dirname(path)]);

    const fd = open(path, "wx");

    write(fd, `<?xml version = "1.0" encoding = "UTF-8" ?>\n`);

    toXML(fd, node);

    close(fd);
}

function toXML(fd, node, tabs = 0)
{
    const toChildrenXML = () => node.children
        .map((node, index) => toXML(fd, node, tabs + 1));

    if (tabs === 0)
    {
        const id = "0";
        const name = node.title;
        const tests = "0";
        const failures = "0";
        const time = "0";

        return tag(fd, tabs, "testsuites",
            { id, name, tests, failures, time },
            toChildrenXML);
    }

    if (node.type === "suite")
        return tag(fd, tabs, "testsuite",
            { name: node.title }, toChildrenXML);

    const { title, report } = node;
    const success = report.outcome.type === "success";
    const children = success ?
        null :
        false ?
            () => tag(fd, tabs + 1, "skipped") :
            () => tag(fd, tabs + 1, "failure",
                { message: value.message, type: "FATAL" },
                () => write(fd, escape(value.stack) + "\n"));

    return tag(fd, tabs, "testcase",
        { name: node.title }, children);
}

function tag(fd, tabs, name, attributes = { }, children)
{
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
