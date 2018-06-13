const { createWriteStream } = require("fs");
const browserify = require("browserify");


(async function ()
{
    try
    {
        const input = `${__dirname}/src/lithograph-browser.js`;
        const output = `${__dirname}/lithograph-browser.js`;

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
            .add(`${__dirname}/src/lithograph-browser.js`)
            .bundle()
            .pipe(createWriteStream(output))
            .on("error", reject)
            .on("end", () => resolve(result));
    });
}
