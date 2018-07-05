const PagePrototype = require("puppeteer/lib/Page").prototype;
const BrowserContextPrototype = require("puppeteer/lib/Browser")
    .BrowserContext.prototype;

PagePrototype._blah = async function (HTML)
{
    const client = this._client;
    const result = await client.send(
        "Page.startScreencast",
        { format:"jpg", quality: 50 });

    console.log(result);
}

BrowserContextPrototype.static = async function (HTML)
{
    const page = await this.newPage();

    await page.static(HTML);

    return page;
}