const { dirname } = require("path");
const { spawnSync } = require("child_process");

const { List } = require("immutable");

const { openSync: open, writeSync: write, closeSync: close } = require("fs");
const escape = (map =>
    (regexp =>
        string => string.replace(regexp, item => map[item]))
    (new RegExp(`[${Object.keys(map).join("")}]`, "g")))
    ({ ">": "&gt;", "<": "&lt;", "'": "&apos;", "\"": "&quot;", "&": "&amp;" });


module.exports = function (path, root, states, time)
{
    spawnSync("mkdir", ["-p", dirname(path)]);

    const fd = open(path, "wx");

    write(fd, `<?xml version = "1.0" encoding = "UTF-8" ?>\n`);

    toXML(fd, root, states, List());

    close(fd);
}

function toXML(fd, node, states, keyPath, tabs = 0)
{
    const toChildrenXML = () => node.children.map((node, index) =>
        toXML(  fd, node, states,
                keyPath.push("children", index), tabs + 1));

    if (keyPath.size <= 0)
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

    if (node.children.size > 0)
        return tag(fd, tabs, "testsuite",
            { name: node.title }, toChildrenXML);

    if (node.blocks.size > 0 && node.children.size <= 0)
    {
        const { individual } = states.get(keyPath);
        const success = individual === 3;
        const children = success ?
            null :
            () => tag(fd, tabs + 1, "failure",
                { message: "yikes", type: "FATAL" },
                () => write(fd, "Oh no.\n"));

        return tag(fd, tabs, "testcase",
            { name: node.title }, children);
    }
}

function tag(fd, tabs, name, attributes, children)
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
