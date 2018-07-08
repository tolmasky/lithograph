const headless = process.env.headless !== "false";
const requires = JSON.parse(process.env.requires || "[]");
const launched = new Promise((resolve, reject) =>
    setImmediate(() =>
        require("puppeteer").launch({ headless })
            .then(resolve, reject)));

const { dirname } = require("path");
const puppeteerPath = dirname(require.resolve("puppeteer"));

const getPackageDescriptions = require("magic-ws/get-package-descriptions");
const packageDescriptions = getPackageDescriptions([], [puppeteerPath]);

require("magic-ws/modify-resolve-lookup-paths")(packageDescriptions);
require("./static");

// We need to do this to make them available to packages brought in with -r.
const environment = require("./test-environment");

global.fetch = environment.fetch;
global.mock = environment.mock;
global.expect = environment.expect;

requires.map(path => require(path));


module.exports = async function ({ filename, resources, blocks, exports, metaDataPath })
{
    const browser = await launched;
    const context = await browser.createIncognitoBrowserContext();

    context.resources = resources;

    try
    {
        return await require("./test-local")(filename, blocks, exports, context);
    }
    catch (error)
    {
        await require("./screenshots")(browser, `${metaDataPath}/Screenshots`);

        throw error;
    }
    finally
    {
        await Promise.all((await browser.pages())
            .map(page => page.close()));
        await context.close();
    }
}
