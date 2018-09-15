const testEnvironment = require("../test-worker/test-environment");

module.exports = function toEnvironment(allocate)
{
    return { getBrowser, getBrowserContext, ...testEnvironment };

    async function getBrowser()
    {
        const browserWSEndpoint = await allocate("endpoint");
        const puppeteer = require("puppeteer");

        return await puppeteer.connect({ browserWSEndpoint });
    }

    async function getBrowserContext()
    {
        const browser = await getBrowser();
        const browserContext = await browser.createIncognitoBrowserContext();

        return browserContext;
    }
}
