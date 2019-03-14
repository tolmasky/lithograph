const fs = require("fs");
const mime = require("mime");
const puppeteer = require("puppeteer");


module.exports = async function proxySnapshot(browserContext, URL)
{
//    const { destination, ignores } = JSON.parse(
//        process.env.SNAPSHOT);
console.log("YES!");
    const destination = "/Users/tolmasky/Development/tonic/app/__tests__/wild-embeds/stripe.com/snapshot-2019-03-19";

    fs.mkdirSync(destination, { recursive: true });
    fs.mkdirSync(`${destination}/responses`);

    const manifest = Object.create(null);
    const page = await browserContext.newPage();
    const onRequest = request => request.continue();
    const onResponse = async function (response)
    {
        if (response.status() !== 200)
            return;

        const URL = response.request().url();

        if (hasOwnProperty.call(manifest, URL))
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
