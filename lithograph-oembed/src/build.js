const { createWriteStream } = require("fs");
const browserify = require("browserify");
const babelify = require("babelify");


(async function ()
{
    try
    {
        const input = `${__dirname}/bootstrap.js`;
        const output = `${__dirname}/../dist/bootstrap.bundle.js`;

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
    const presets = ["react"];
    const plugins = ["transform-object-rest-spread"];

    return new Promise(function (resolve, reject)
    {
        browserify()
            .add(input)
            .transform("babelify", { presets, plugins })
            .bundle()
            .pipe(createWriteStream(output))
            .on("error", reject)
            .on("end", () => resolve(result));
    });
}
