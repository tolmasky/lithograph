const { writeFile: write } = require("fs");
var end_location = "/tmp/frames";


PagePrototype._blah = async function ()
{console.log("STARTING");
    const state = { open:true, count:0, writing:0 };
    const client = this._client;

    this.on("close", () => (state.open = false, check(state)));
    this._client.on("Page.screencastFrame", function ({ data, sessionId, metadata })
    {
        const index = state.count++;
        ++state.writing;
console.log(index, metadata.timestamp);
        write(`${end_location}/frame-${metadata.timestamp.toFixed(10)}.jpg`, data, "base64", function (err)
        {
            --state.writing;
            check(state);
        });

        client.send("Page.screencastFrameAck", { sessionId });
    });

    client.send(
        "Page.startScreencast",
        { format:"jpeg", quality: 50 });
}

function check(state)
{console.log(state);
    if (state.open || state.writing > 0)
        return;

    console.log("WOULD NOW MAKE MOVIE!");
}