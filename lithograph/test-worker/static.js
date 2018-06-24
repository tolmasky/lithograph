const PagePrototype = require("puppeteer/lib/Page").prototype;
const BrowserContextPrototype = require("puppeteer/lib/Browser")
    .BrowserContext.prototype;

PagePrototype.static = async function (HTML)
{
    const status = 200;
    const contentType = "text/html;";
    const body = /<!DOCTYPE HTML>/i.test(HTML) ?
        HTML : `<!DOCTYPE HTML>${HTML}`;
    const listener = request =>
        request.url() !== "https://lithograph/static" ? 
            request.continue() :
            request.respond({ status, contentType, body });

    await this.setRequestInterception(true);

    this.on("request", listener);

    await this.goto("https://lithograph/static");

    this.removeListener("request", listener);

    await this.setRequestInterception(false);
}

BrowserContextPrototype.static = async function (HTML)
{
    const page = await this.newPage();

    await page.static(HTML);

    return page;
}