const { extname } = require("path");
const { readFile } = require("fs");
const { internalModuleStat } = process.binding("fs");

const { getType } = require("mime");
const { Set } = require("@algebraic/collections");

const { Rule, Route, Action } = require("./rule");


module.exports = function mount(baseURL, mountPath)
{
    const route = Route.fromPattern(`${baseURL}(/*relativePath)`);
    const callback = handle(mountPath);
    const action = Action.Custom({ callback });

    // FIXME: Should we be handling "all" or just GET?
    return Rule.methods.get(route, action);
}

function handle(mountPath)
{
    return function (request, { relativePath })
    {
        const candidatePath = `${mountPath}/${relativePath}`;
        const initialStat = internalModuleStat(candidatePath);
        const revisedPath = initialStat == 1 ?
            `${candidatePath}/index.html` : candidatePath;
        const revisedStat = initialStat == 1 ?
            internalModuleStat(revisedPath) : initialStat;
    
        if (revisedStat !== 0)
            return request.respond({ status: 404 });
    
        const status = revisedStat === 0 ? 200 : 404;
        const extension = extname(revisedPath);
        const contentType = getType(extension);
    
        readFile(revisedPath, "utf-8", (error, body) =>
            error ?
                request.respond({ status: 500 }) :
                request.respond({ status: 200, contentType, body }));
    }
}
