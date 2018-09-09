const { Map } = require("immutable");
const testEnvironment = require("./test-worker/test-environment");
require("./magic-ws-puppeteer");
require("./test-worker/static");

global.fetch = testEnvironment.fetch;

module.exports = function generateGetEnvironment(push)
{
    const FileProcess = require("./file-process");
    const template = { getBrowser, getBrowserContext, ...testEnvironment };
    const getEnvironment = () => Map(Object.keys(template)
        .map(key => [key, (...args) => template[key](...args)]))
        .toObject();
    const event = FileProcess.GeneratedGetEnvironment({ getEnvironment });

    push(event);

    async function getBrowserContext()
    {
        return await (await getBrowser(push))
            .createIncognitoBrowserContext();
    }

    async function getBrowser()
    {
        const browserWSEndpoint = await new Promise((resolve, reject) =>
            push(FileProcess.GetBrowserCalled({ resolve, reject })));

        return await require("puppeteer").connect({ browserWSEndpoint });
    }
}
