const { Cause, IO, field, event, update } = require("@cause/cause");
const puppeteer = require("puppeteer");


const Browser = Cause("Browser",
{
    [field `ready`]: false,
    [field `launch`]: false,
    [field `reset`]: -1,
    [field `endpoint`]: -1,
    [field `puppeteerBrowser`]: -1,
    [field `headless`]: true,

    init: ({ headless }) =>
        ({ launch: IO.start(push => launch({ headless }, push)) }),

    [event.in `Launched`]: { puppeteerBrowser: -1 },
    [event.on `Launched`]: (browser, { puppeteerBrowser }) =>
    [
        browser
            .set("ready", true)
            .set("puppeteerBrowser", puppeteerBrowser)
            .set("endpoint", puppeteerBrowser.wsEndpoint()),
        [Cause.Ready()]
    ],

    [event.in `Reset`]: { },
    [event.on `Reset`]: browser => browser.set("reset",
        IO.fromAsync(() => reset(browser.get("puppeteerBrowser")))),

    [event.out `DidReset`]: { },
    [event.in `ClosedAllPages`]: { },
    [event.on `ClosedAllPages`]: browser => [browser, [Browser.DidReset()]],
});

module.exports = Browser;

async function reset(browser)
{
    await Promise.all(
        (await browser.pages())
            .map(page => page.close()));

    return Browser.ClosedAllPages();
}

function launch({ headless }, push)
{
    const state = { launched: false, cancelled: false, puppeteerBrowser: null };

    setImmediate(async function ()
    {
        if (state.cancelled)
            return;

        state.puppeteerBrowser =
            await puppeteer.launch({ headless });
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
