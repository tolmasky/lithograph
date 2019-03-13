const { resolve } = require("path");
const moment = require("moment");

const options = require("commander")
    .version(require("./package").version)
    .option("-o, --output [output]",
        "",
        `${process.cwd()}/snapshot-${moment().format("YYYY-MM-DD")}`)
    .option("--no-headless")
    .parse(process.argv); 
const URL = options.args[0];

require("./snapshot")(
{
    URL,
    destination: options.output,
    headless: !!options.headless
});
