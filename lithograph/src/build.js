const { createWriteStream } = require("fs");
const browserify = require("browserify");


(async function ()
{
    try
    {
        const input = `${__dirname}/preload.js`;
        const output = `${__dirname}/../test-worker/preload.js`;

        await compile(input, output);
    }
    catch (error)
    {
        console.log(error);

        process.exit(1);
    }
})();

function compile(input, output)
{
    return new Promise(function (resolve, reject)
    {
        browserify()
            .require(input, { expose: "preload" })
            .bundle()
            .pipe(createWriteStream(output))
            .on("error", reject)
            .on("end", () => resolve(result));
    });
}
