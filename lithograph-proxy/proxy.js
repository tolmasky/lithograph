const Rule = require("./rule");

const proxy = process.env.SNAPSHOT ?
    require("./proxy-snapshot") :
    async function proxy(browserContext, URL, rules)
    {
        const onRequest = toOnRequest(Rule.parse(rules));
        const page = await browserContext.newPage();

        await page.setRequestInterception(true);

        page.on("request", onRequest);

        await page.goto(URL);

        return page;
    };

module.exports = proxy;
module.exports.proxy = proxy;

module.exports.snapshot = (function ()
{
    const { dirname } = require("path");
    const { readFileSync } = require("fs");
    const readJSON = path => JSON.parse(readFileSync(path, "utf-8"));

    return function fromSnapshotPath(snapshotPath)
    {
        const manifest = readJSON(`${snapshotPath}/manifest.json`);
        const callback = function (request)
        {
            const URL = request.url();
            const dataPath = `${snapshotPath}/${manifest[URL]}`;

            const body = readFileSync(dataPath);
            const headersPath = `${dirname(dataPath)}/headers.json`;
            const headers = readJSON(headersPath);

            request.respond({ ...headers, body });
        }
        const action = Rule.Action.Custom({ callback });

        return Object
            .keys(manifest)
            .reduce((value, URL) =>
                (value[URL] = action, value),
                Object.create(null));
    }
})();

function toOnRequest(rules)
{
    return function onRequest(request)
    {
        const URL = request.url();
        const [action, args] = Rule.find(rules, URL);

        if (action === false ||
            action === Rule.Action.Deny)
            return request.respond({ status: 404 });

        if (action === Rule.Action.Allow)
            return request.continue();

        return action.callback(request, ...args);
    }
}
