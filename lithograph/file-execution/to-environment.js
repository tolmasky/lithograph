const testEnvironment = require("../test-worker/test-environment");

global.fetch = testEnvironment.fetch;

module.exports = function toEnvironment(allocate)
{
    return { getBrowser, getBrowserContext, ...testEnvironment };

    async function getBrowser()
    {
        const browserWSEndpoint = await allocate("endpoint");
        const puppeteer = require("puppeteer");
global.b = await puppeteer.connect({ browserWSEndpoint });
        return await global.b;//puppeteer.connect({ browserWSEndpoint });
    }

    async function getBrowserContext()
    {
        const browser = await getBrowser();
        const browserContext = await browser.createIncognitoBrowserContext();

        return browserContext;
    }
}
