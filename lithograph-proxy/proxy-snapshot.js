const { union, is } = require("@algebraic/type");
const { Set, List } = require("@algebraic/collections");

const Rule = require("./rule");
const { SnapshotConfiguration, Record } = require("./snapshot-configuration");
const toOnRequest = require("./to-on-request");

const mime = require("mime");
const uuid = require("uuid").v4;

const fs = require("fs");
const { spawnSync: spawn } = require("child_process");
const rmrf = directory => spawn("rm", ["-rf", directory]);
const tar = (filename, cwd) => spawn("tar", ["-cvf", filename, "."], { cwd });


module.exports = async function proxySnapshot(browserContext, ...rules)
{
    const configuration = rules.find(is(SnapshotConfiguration));
    const snapshotRules = configuration.rules;
    const tmpDestination = `/tmp/${uuid()}`;

    if (fs.existsSync(tmpDestination))
        rmrf(tmpDestination);

    fs.mkdirSync(tmpDestination, { recursive: true });
    fs.mkdirSync(`${tmpDestination}/responses`);

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

        // It's important that all the steps in writing the different components
        // of the response happen synchronously, because if not the page might
        // get closed part-way through the process(?). We were experiencing a
        // bug where we had the headers but not the data, and I think this is
        // why. For this reason, we put this up-front here, so we either have
        // everything or nothing:
        const buffer = bodyPath !== false && await response.buffer();

        fs.mkdirSync(`${tmpDestination}/${directory}`);
        fs.writeFileSync(`${tmpDestination}/${manifest[URL]}`,
            JSON.stringify(serialized), "utf-8");

        if (bodyPath !== false)
            fs.writeFileSync(`${tmpDestination}/${directory}/${bodyPath}`,
                buffer);
    }

    await page.setRequestInterception(true);

    page.on("request", onRequest);
    page.on("response", onResponse);
    page.on("close", async function ()
    {
        page.removeListener("request", onRequest);
        page.removeListener("response", onResponse);

        fs.writeFileSync(`${tmpDestination}/manifest.json`,
            JSON.stringify(manifest));

        tar(configuration.filename, tmpDestination);
        rmrf(tmpDestination);
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
