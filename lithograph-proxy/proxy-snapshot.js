const { union, is } = require("@algebraic/type");
const { Set, List } = require("@algebraic/collections");

const Rule = require("./rule");
const { SnapshotConfiguration, Record } = require("./snapshot-configuration");
const toOnRequest = require("./to-on-request");

const fs = require("fs");
const { spawnSync: spawn } = require("child_process");
const mime = require("mime");


module.exports = async function proxySnapshot(browserContext, URL, ...rules)
{
    const configuration = rules.find(is(SnapshotConfiguration));
    const destination = configuration.filename;
    const snapshotRules = configuration.rules;

    if (fs.existsSync(destination))
        spawn("rm", ["-rf", destination]);

    fs.mkdirSync(destination, { recursive: true });
    fs.mkdirSync(`${destination}/responses`);

    const manifest = Object.create(null);
    const page = await browserContext.newPage();
    const onRequest = toOnRequest(snapshotRules);
    const onResponse = async function (response)
    {
        if (response.status() !== 200)
            return;

        const request = response.request();
        const URL = request.url();

        // This should be a sufficient test:
        //const record = request.headers()["x-lithograph-proxy-record"] === "true";

        // But it seems that modified request headers don't stick in puppeteer:
        // https://github.com/GoogleChrome/puppeteer/issues/4165

        // So instead, we have to rerun our rules.
        const [action] = Rule.find(snapshotRules, request.method(), URL);
        const record = action === Record;

        if (!record || hasOwnProperty.call(manifest, URL))
            return;

        console.log("SAVING " + URL);

        const index = Object.keys(manifest).length;
        const directory = `responses/${index}`;

        const headers = response.headers();
        const extension = mime.getExtension(headers["content-type"]) || "data";

        const dataPath = `${directory}/data.${extension}`;
        const headersPath = `${directory}/headers.json`;

        manifest[URL] = dataPath;

        const buffer = await response.buffer();

        fs.mkdirSync(`${destination}/${directory}`);
        fs.writeFileSync(`${destination}/${headersPath}`,
            JSON.stringify(headers), "utf-8");
        fs.writeFileSync(`${destination}/${dataPath}`, buffer);
    }

    await page.setRequestInterception(true);

    page.on("request", onRequest);
    page.on("response", onResponse);
    page.on("close", async function ()
    {
        page.removeListener("request", onRequest);
        page.removeListener("response", onResponse);

        fs.writeFileSync(`${destination}/manifest.json`, JSON.stringify(manifest));
    });

    await page.goto(URL);

    return page;
}
