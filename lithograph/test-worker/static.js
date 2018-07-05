const { parse } = require("url");
const { Map } = require("immutable");

const PagePrototype = require("puppeteer/lib/Page").prototype;
const BrowserContextPrototype = require("puppeteer/lib/Browser")
    .BrowserContext.prototype;

const getPreloadSource = (contents => () =>
    contents || (contents = require("fs")
    .readFileSync(
        require.resolve("./test-environment-preload.bundle.js"),
        "utf-8")))();

const goto = PagePrototype.goto;


PagePrototype.goto = function (URL)
{
    const { protocol, hostname, pathname } = parse(URL);

    if (protocol !== "resource:")
        return goto.call(this, URL);

    const { resources } = this.target().browserContext();
    const name = `${hostname}${pathname || ""}`;

    return this.static(resources[name].contents);
}

PagePrototype.static = async function (HTML)
{
    this.logs = [];

    const status = 200;
    const contentType = "text/html;";
    const body = /<!DOCTYPE HTML>/i.test(HTML) ?
        HTML : `<!DOCTYPE HTML>${HTML}`;
    const listener = intercept({ status, contentType, body });

    const errors = [];
    const onError = error => errors.push(error);

    await this.setRequestInterception(true);

    this.on("console", message =>
        this.logs.push({ type: message.type(), text: message.text() }));

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
        `const { preload, expect, mock } = require("test-environment-preload");\n` +
        `console.log([expect, mock]);\n` +
        `preload([${(this._preloadScripts || []).join(",")}])`);

    this._preloadScripts = [];

    await goto.call(this, "https://lithograph/static");

//    this.removeListener("request", listener);
    this.removeListener("pageerror", onError);

//    await this.setRequestInterception(false);

    if (errors.length > 0)
        throw errors[0];
}

const SmallFavicon = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAABmJLR0QA/wD/AP+gvaeTAAA" +
    "AADUlEQVQImWNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==", "base64");

function intercept({ status, contentType, body })
{
    return function (request)
    {
        const URL = request.url();

        if (URL === "https://lithograph/favicon.ico")
            return request.respond(
            {
                status: 200,
                contentType: "img/png",
                body: SmallFavicon
            });

        if (URL === "https://lithograph/static")
            return request.respond({ status, contentType, body });

        request.continue();
    }
}

PagePrototype.test = function (f, ...args)
{
    return this.evaluateHandle(
        ([expect, mock], f, ...args) => eval(f)(...args),
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
