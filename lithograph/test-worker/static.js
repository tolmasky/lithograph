const { parse } = require("url");
const { Map } = require("immutable");

const PagePrototype = require("puppeteer/lib/Page").prototype;
const BrowserContextPrototype = require("puppeteer/lib/Browser").BrowserContext.prototype;

const getPreloadSource = (contents => () =>
    contents ||
    (contents = require("fs")
        .readFileSync(require.resolve("./preload.js"), "utf-8")))();

const goto = PagePrototype.goto;


PagePrototype.goto = function (URL)
{
    const { protocol, hostname, pathname } = parse(URL);

    if (protocol !== "resource:")
        return goto.apply(this, URL);

    const { resources } = this.target().browserContext();
    const name = `${hostname}${pathname || ""}`;

    return this.static(resources[name].contents);
}

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

    await this.evaluateOnNewDocument(
        `${getPreloadSource()};\n` +
        `const { preload, expect } = require("preload");\n` +
        `console.log(expect);\n` +
        `preload([${(this._preloadScripts || []).join(",")}])`);

    this._preloadScripts = [];

    await goto.call(this, "https://lithograph/static");

    this.removeListener("request", listener);
    this.removeListener("pageerror", onError);

    await this.setRequestInterception(false);

    if (errors.length > 0)
        throw errors[0];
}

PagePrototype.test = function (f, ...args)
{
    return this.evaluate(
        (expect, f, ...args) => eval(f)(...args),
        this.testScope, f + "", ...args);
}

PagePrototype.preload = function (...args)
{
    if (!this._preloadScripts)
        this._preloadScripts = [];

    const serialize = value =>
        typeof value === "function" ? `${JSON.stringify(value + "")}` :
        typeof value === "undefined" ? "undefined" :
        JSON.stringify(value);
    const serialized = `[${args.map(serialize).join(", ")}]`;

    this._preloadScripts.push(serialized);
}

BrowserContextPrototype.static = async function (HTML)
{
    const page = await this.newPage();

    await page.static(HTML);

    return page;
}
