const { createWriteStream } = require("fs");
const browserify = require("browserify");


(async function ()
{
    try
    {
        const input = `${__dirname}/test-environment-preload.js`;
        const output = `${__dirname}/test-environment-preload.bundle.js`;

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
            .require(input, { expose: "test-environment-preload" })
            .bundle()
            .pipe(createWriteStream(output))
            .on("error", reject)
            .on("end", () => resolve(result));
    });
}
