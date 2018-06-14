const headless = process.env.HEADLESS !== "false";
const launched = new Promise((resolve, reject) =>
    setImmediate(() =>
        require("puppeteer").launch({ headless, args:["--no-sandbox"] })
            .then(resolve, reject)));

const getLithographBrowser = () => (contents =>
    contents || (contents = require("fs")
        .readFileSync(require.resolve("@lithograph/browser"), "utf-8")))();


module.exports = async function ({ blocks })
{
    const browser = await launched;
    const page = await browser.newPage();
    /*
    page.on("console", async msg =>
    {
        for (let i = 0; i < msg.args().length; ++i)
            console.log(`${i}: ${(await msg.args())[i]}`)
    });*/

    await page.evaluateOnNewDocument(getLithographBrowser());

    try
    {
        let navigated = false;

        for (const { code, language } of blocks)
        {
            if (language === "html" && (navigated = true))
                await post(page, "http://localhost:9999/", code);

            else if (language === "javascript")
                if (navigated)
                    await page.evaluate(`(async function () { ${code} })()`);
                else
                    await page.evaluateOnNewDocument(code);
        }

        console.log("DONE");
    }
    finally
    {
        page.close();
    }
}

// This sucks. But we have to do it this way until Puppeteer supports POST
// requests.
async function post(page, URL, postData)
{
    const status = 200;
    const contentType = "text/html;";
    const body = postData;

    const listener = request =>
        request.url() !== URL ? 
            request.continue() :
            request.respond({ status, contentType, body });

    await page.setRequestInterception(true);

    page.on("request", listener);

    await page.goto(URL);
}
