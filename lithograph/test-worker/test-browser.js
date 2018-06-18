const { browserLogs } = process.env;

const getLithographBrowser = () => (contents =>
    contents || (contents = require("fs")
        .readFileSync(require.resolve("@lithograph/expect/browser"), "utf-8")))();


module.exports = async function ([HTML, ...blocks])
{console.log(HTML, ...blocks);
    const page = await open(browser, HTML);

    for (const { code } of blocks)
        await page.evaluate(`(async function () { ${code} })()`);
}

async function open(browser, HTML)
{
    const page = await browser.newPage();

    page.evaluateOnNewDocument(getLithographBrowser());

    if (browserLogs)
        page.on("console", async msg =>
        {
            for (let i = 0; i < msg.args().length; ++i)
                console.log(`${i}: ${(await msg.args())[i]}`)
        });

    const status = 200;
    const contentType = "text/html;";

    const listener = request =>
        request.url() !== "lithograph://static" ? 
            request.continue() :
            request.respond({ status, contentType, body: HTML });

    await page.setRequestInterception(true);

    page.on("request", listener);

    await page.goto("lithograph://static");

    return page;
}
