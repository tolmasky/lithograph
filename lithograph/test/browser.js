const { Cause, IO, field, event, update } = require("cause");
const puppeteer = require("puppeteer");


const Browser = Cause("Browser",
{
    [field `ready`]: false,
    [field `launch`]: IO.start(launch),
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

function launch(push)
{
    const state = { launched: false, cancelled: false, puppeteerBrowser: null };

    setImmediate(async function ()
    {
        if (state.cancelled)
            return;

        state.puppeteerBrowser =
            await puppeteer.launch({ headless: false });
        state.launched = true;

        push(Browser.Launched({ puppeteerBrowser: state.puppeteerBrowser }));
    });

    return function ()
    {
        if (state.launched)
            state.puppeteerBrowser.close();

        state.cancelled = true;
    };
}
