const { Cause, IO, field, event, update } = require("cause");
const puppeteer = require("puppeteer");


const Browser = Cause("Browser",
{
    [field `ready`]: false,
    [field `launch`]: IO.fromAsync(launch),
    [field `endpoint`]: -1,
    [field `puppeteerBrowser`]: -1,

    [event.in `Launched`]: { puppeteerBrowser: -1 },
    [event.on `Launched`]: (browser, { puppeteerBrowser }) =>
    [
        browser
            .set("ready", true)
            .set("puppeteerBrowser", puppeteerBrowser)
            .set("endpoint", puppeteerBrowser.wsEndpoint()),
        [Cause.Ready()]
    ]
});

module.exports = Browser;

async function launch()
{
    await new Promise(resolve => setImmediate(resolve));

    const puppeteerBrowser = await puppeteer.launch({ headless: false });

    return Browser.Launched({ puppeteerBrowser });
}
