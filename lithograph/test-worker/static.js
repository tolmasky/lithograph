const PagePrototype = require("puppeteer/lib/Page").prototype;
const BrowserContextPrototype = require("puppeteer/lib/Browser").BrowserContext.prototype;

const getLithographBrowser = () => (contents =>
    contents || (contents = require("fs")
        .readFileSync(require.resolve("@lithograph/expect/browser"), "utf-8")))();


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

    const errors = [];
    const onError = error => errors.push(error);

    await this.setRequestInterception(true);

    this.on("pageerror", onError);
    this.on("request", listener);

    const captureScope = message =>
    {
        this.testScope = message.args()[0];
        this.removeListener("console", captureScope);
    }

    this.on("console", captureScope);

    await this.evaluateOnNewDocument(getLithographBrowser() + ";console.log({ expect: window.expect })");

    await this.goto("https://lithograph/static");

    this.removeListener("request", listener);
    this.removeListener("pageerror", onError);

    await this.setRequestInterception(false);

    if (errors.length > 0)
        throw errors[0];
}

PagePrototype.test = function (f, ...args)
{
    return this.evaluate(
        ({ mock, expect }, f, ...args) => eval(f)(...args),
        this.testScope, f + "", ...args);
}
/*
PagePrototype.preload = function (f)
{
    page.mainFrame().evaluateOnNewDocument(f);
}*/

BrowserContextPrototype.static = async function (HTML)
{
    const page = await this.newPage();

    await page.static(HTML);

    return page;
}
