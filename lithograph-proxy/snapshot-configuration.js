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

    return function toProxyRules({ filename })
    {
        const tarRead = toTarRead(filename);
        const readJSON = path => JSON.parse(tarRead(path, "utf-8"));
        const manifest = readJSON("manifest.json");
        const callback = function (request)
        {
            const URL = request.url();
            const responsePath = manifest[URL];
            const { status, headers, bodyPath } = readJSON(responsePath);
            const bodyComponent = bodyPath &&
                { body: tarRead(`${dirname(responsePath)}/${bodyPath}`) };

            request.respond({ status, headers, ...bodyComponent });
        }
        const action = Rule.Action.Custom({ callback });

        return Object.keys(manifest)
            .map(URL => Rule.Route.Exact({ URL }))
            .map(route => Rule.methods.all(route, action));
    }
})();

const toTarRead = (function ()
{
    const { spawnSync: spawn } = require("child_process");
    const { normalize } = require("path");

    // tar on Linux expects the internal paths to be ./responses/${blah}
    // Specifically, we *need* the leading "./", and can't have un-normalized
    // instances of "./" in the center of the path.
    const toTarPath = path => `./${normalize(path)}`;

    return function toTarRead(tarPath)
    {
        return function tarRead(filename, format)
        {
            const inTarPath = toTarPath(filename);

            // We should consider storing the size of responses in the future,
            // but for now just etting maxBuffer to Infinity to avoid
            // prematurely terminating is fine.
            const { stdout } = spawn("tar",
                ["-xvOf", tarPath, inTarPath],
                { maxBuffer: Infinity });

            return format === "utf-8" ?
                stdout.toString(format) :
                stdout;
        }
    }
})();
