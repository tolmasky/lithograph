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
    // Speficially, we *need* the leading "./", and can't have un-normalized
    // instances of "./" in the center of the path.
    const toTarPath = path => `./${normalize(path)}`;

    return function toTarRead(tarPath)
    {
        return function tarRead(filename, format)
        {
            const inTarPath = toTarPath(filename);

            // Node limits the size of the stdout buffer in `spawn`, so we need
            // to make sure we make it big enough for the output. I'm not a huge
            // fan of the magic number searching here, we should probably store
            // the size in the manifest file. Maybe we should also be storing it
            // *as* its original gzip too?
            const maxBuffer = +(spawn("tar", ["-vtf", tarPath])
                .stdout.toString()
                .split("\n")
                .find(line => line.endsWith(inTarPath))
                .split(/\s+/)[4]);

            const { stdout } = spawn("tar",
                ["-xvOf", tarPath, inTarPath],
                { maxBuffer });

            return format === "utf-8" ?
                stdout.toString(format) :
                stdout;
        }
    }
})();
