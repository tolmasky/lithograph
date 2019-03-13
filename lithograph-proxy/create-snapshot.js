const fs = require("fs");

const mime = require("mime");
const puppeteer = require("puppeteer");


module.exports = async function ({ destination, URL })
{
    fs.mkdirSync(destination, { recursive: true });
    fs.mkdirSync(`${destination}/responses`);

    
    const manifest = Object.create(null);
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const onRequest = function (request)
    {
//        push(Resource({ URL: request.url() }));
        request.continue();
    }


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

    await page.goto(URL);
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log("DONE");

    page.removeListener("request", onRequest);
    page.removeListener("response", onResponse);

    await page.setRequestInterception(false);

    fs.writeFileSync(`${destination}/manifest.json`, JSON.stringify(manifest));
}

module.exports({ destination: "snapshot-2019-03-07", URL: "https://stripe.com" });

