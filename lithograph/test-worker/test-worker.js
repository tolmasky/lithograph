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
const environment = require("./test-local");

require("magic-ws/modify-resolve-lookup-paths")(packageDescriptions);
require("./static");

requires.map(path => require(path));


module.exports = async function ({ filename, resources, blocks, exports, metaDataPath })
{
    const browser = await launched;
    const context = await browser.createIncognitoBrowserContext();

    context.resources = resources;

    try
    {
        return await environment(filename, blocks, exports, context);
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
