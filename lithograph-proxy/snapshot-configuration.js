const { data, string } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Rule = require("./rule");


const SnapshotConfiguration = data `SnapshotConfiguration` (
    filename    => string,
    rules       => List(Rule) );


module.exports = SnapshotConfiguration;
module.exports.SnapshotConfiguration = SnapshotConfiguration;

const Record = Rule.Action.Custom({ callback: () => Record });

module.exports.Record = Record;

module.exports.toProxyRules = (function ()
{
    const { dirname } = require("path");
    const { readFileSync } = require("fs");
    const readJSON = path => JSON.parse(readFileSync(path, "utf-8"));

    return function toProxyRules({ filename })
    {
        const manifest = readJSON(`${filename}/manifest.json`);
        const callback = function (request)
        {
            const URL = request.url();
            const responsePath = `${filename}/${manifest[URL]}`;
            const { status, headers, bodyPath } = readJSON(responsePath);
            const bodyComponent = bodyPath &&
                { body: readFileSync(`${dirname(responsePath)}/${bodyPath}`) };

            request.respond({ status, headers, ...bodyComponent });
        }
        const action = Rule.Action.Custom({ callback });

        return Object.keys(manifest)
            .map(URL => Rule.Route.Exact({ URL }))
            .map(route => Rule.methods.all(route, action));
    }
})();
