const { union, is } = require("@algebraic/type");
const { Set, List } = require("@algebraic/collections");

const Rule = require("./rule");
const { SnapshotConfiguration, Record } = require("./snapshot-configuration");
const toOnRequest = require("./to-on-request");

const fs = require("fs");
const { spawnSync: spawn } = require("child_process");
const mime = require("mime");


module.exports = async function proxySnapshot(browserContext, ...rules)
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
    const onRequest = toOnRequest(rules, true);
    const onResponse = async function (response)
    {
        const status = response.status();

        if (status < 200 || status >= 400)
            return;

        const request = response.request();
        const URL = request.url();

        // This should be a sufficient test:
        const { record } = request;

        if (!record || hasOwnProperty.call(manifest, URL))
            return;

        console.log("SAVING " + URL);

        const index = Object.keys(manifest).length;
        const directory = `responses/${index}`;

        const headers = response.headers();
        const bodyPath = getBodyPath(status, headers);
        const serialized = { status, headers, bodyPath };

        manifest[URL] = `${directory}/response.json`;

        fs.mkdirSync(`${destination}/${directory}`);
        fs.writeFileSync(`${destination}/${manifest[URL]}`,
            JSON.stringify(serialized), "utf-8");

        if (bodyPath === false)
            return

        const buffer = await response.buffer();
        const absoluteBodyPath = `${destination}/${directory}/${bodyPath}`;

        fs.writeFileSync(absoluteBodyPath, buffer);
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

    return page;
}

function getBodyPath(status, headers)
{
    if (status < 200 || status >= 300)
        return false;

    const type = headers["content-type"];
    const extension = mime.getExtension(type) || "data";

    return `./data.${extension}`;
}
