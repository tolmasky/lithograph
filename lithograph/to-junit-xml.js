const { dirname } = require("path");
const { spawnSync } = require("child_process");

const { List } = require("immutable");

const { openSync: open, writeSync: write, closeSync: close } = require("fs");


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
        return tag(fd, tabs, "testcase",
            { name: node.title }, () => { });
}

function tag(fd, tabs, name, attributes, children)
{
    const attributesString = Object
        .keys(attributes)
        .map(key => `${key} = ${JSON.stringify(attributes[key])}`)
        .join(" ");
    const spaces = " ".repeat(tabs * 4);

    write(fd, `${spaces}<${name} ${attributesString}>\n`);

    children();

    write(fd, `${spaces}</${name}>\n`);
}