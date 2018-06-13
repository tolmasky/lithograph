const filename = process.argv[2];
const f = require(filename);

process.on("message", async function ({ identifier, args })
{
    const result = await (async function ()
    {
        try
        {
            return [true, [0, await f(...args)]];
        }
        catch (error)
        {console.log("oh...", error);
            if (!(error instanceof Error))
                return [false, [0, error]];

            const { stack, name, message } = error;
            const value = { stack, name, message };

            return [false, [1, value]];
        }
    })();

    process.send({ identifier, result });
});
