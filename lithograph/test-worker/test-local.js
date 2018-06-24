const { dirname } = require("path");
const Module = require("module");

const expect = require("@lithograph/expect");
const ModuleRequire = Module.prototype.require;


module.exports = async function (filename, blocks, parent, browser)
{
    const contents = blocks.map(({ code }) => code).join("\n");
    const module = new Module(filename, null);

    // FIXME: Should be require from originating module?
    const parentExports = JSON.parse(parent,
        reviver(module.require.bind(module), expect));

    module.require = testRequire(parentExports);
    module.filename = filename;
    module.paths = Module._nodeModulePaths(dirname(filename));

    module._compile(`module.exports =
        async (module, exports, browser, expect) => { ${contents} }`,
        filename);
    module.loaded = true;

    const asynchronous = await module
        .exports(module, module.exports = { }, browser, expect);

    return JSON.stringify(module.exports, replacer);
}

function testRequire(parentExports)
{
    return function (path)
    {
        const components = path.split("/");
        const [scope, name, ...rest] = components;

        if (scope === "@lithograph" && name === "parent")
            return parentExports;

        return ModuleRequire.apply(this, arguments);
    }
}

function reviver(require, expect)
{
    return function (key, value)
    {
        if (value.__function === true)
            return (new Function("require", "expect",
            "return " + value.source))(require, expect);
    
        return value;
    }
}

function replacer(key, value)
{
    if (value instanceof require("puppeteer/lib/Page"))
        return undefined;

    if (value instanceof Function)
        return { __function: true, source: value + "" };

    return value;
}
