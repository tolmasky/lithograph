const Route = require("route-parser");
const { readFile } = require("fs");
const { internalModuleStat } = process.binding("fs");


module.exports = async function goto(browserContext, mounts, URL)
{
    const errors = [];
    const onError = error => errors.push(error);
    const page = await browserContext.newPage();

    await page.setRequestInterception(true);

    page.on("pageerror", onError);
    page.on("request", proxies(mounts));

    await page.goto(URL);

    page.removeListener("pageerror", onError);

//    await this.setRequestInterception(false);
console.log(errors);
//    if (errors.length > 0)
//        throw errors[0];
}

function proxies(mounts)
{
    const proxies = Object
        .keys(mounts)
        .map(mount => proxy(mount, mounts[mount]));

    return function union(URL)
    {
        for (const proxy of proxies)
        {
            const path = proxy(URL);

            if (path)
                return path;
        }

        return false;
    }
}

function proxy(URL, path)
{console.log("ROUTE: " + `${URL}/*rest`);
    const route = new Route(`${URL}/*rest`);
    const match = URL =>
        (matches => matches && `${path}/${matches.rest}`)
        (route.match(URL));

    return function (request)
    {
        const path = match(request.url());

        if (path === false)
            return request.continue();

        const initialStat = internalModuleStat(path);
        const revisedPath = initialStat == 1 ?
            `${path}/index.html` : path;
        const revisedStat = initialStat == 1 ?
            internalModuleStat(revisedPath) : initialStat;

        if (revisedStat != 0)
            return request.respond({ status: 404 });

        const status = revisedStat == 0 ? 200 : 404;
        const contentType = "text/html; charset=utf-8";

        readFile(revisedPath, "utf-8", (error, body) =>
            error ?
                request.respond({ status: 500 }) :
                request.respond({ status: 200, contentType, body }));
    }
}
