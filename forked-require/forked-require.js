const { fork } = require("child_process");
const { Map, EmptyMap = Map(), Record } = require("immutable");

const RemoteCall = Record({ resolve:0, reject:0, timeoutID: -1 });
const RemoteFork = Record({ filename:"", process:0, calls: EmptyMap, nextCall:0 });
let RemoteRequire = Record({ forks: EmptyMap, exited: false, exports: EmptyMap })();


module.exports = function (filename, identifier = "")
{
    const UUID = JSON.stringify({ filename, identifier });

    if (!RemoteRequire.exports.has(UUID))
        RemoteRequire = RemoteRequire
            .setIn(["forks", UUID], initRemoteFork(UUID, filename))
            .setIn(["exports", UUID], (...args) =>
                new Promise(function (resolve, reject)
                {
                    const timeoutID = setTimeout(() => { }, 2147483647);
                    const call = RemoteCall({ timeoutID, resolve, reject });

                    RemoteRequire = RemoteRequire
                        .updateIn(["forks", UUID], function (fork)
                        {
                            const identifier = fork.nextCall;

                            fork.process.send({ identifier, args });

                            return fork
                                .setIn(["calls", identifier], call)
                                .set("nextCall", identifier + 1);
                        });
                }));

    return RemoteRequire.exports.get(UUID);
}

process.on("exit", function ()
{
    RemoteRequire = RemoteRequire.set("exited", true);
    RemoteRequire.forks.forEach(({ process }) => process.kill("SIGHUP"));
});

function initRemoteFork(UUID, filename)
{
    const remoteForkExited = () => exited(UUID);
    const listeners = 
    {
        message: (...args) => forwardRemoteCall(UUID, ...args),
        exit: remoteForkExited,
        error: remoteForkExited,
        close: remoteForkExited,
        disconnect: remoteForkExited
    };

    const process = Object.keys(listeners).reduce(
        (process, event) => process.on(event, listeners[event]),
        fork(`${__dirname}/forked-wrapper.js`, [filename]));

    process.unref();
    process.channel.unref();

    return RemoteFork({ filename, process, listeners });
}

function exited(UUID)
{
    RemoteRequire = RemoteRequire.updateIn(UUID, fork =>
    {
        Object.keys(listeners)
            .forEach(event =>
                process.removeListener(event, listeners[event]));

        return fork.updateIn("calls", calls =>
        {
            calls.map((calls, identifier) => forwardRemoteCall(UUID,
            {
                identifier,
                result: [1, [0, new Error("Remote hung up")]]
            }));

            return EmptyMap;
        });
    });

    try { RemoteRequire.get(UUID).process.kill("SIGHUP") }
    catch (error) { }
    
    if (RemoteRequire.exited)
        RemoteRequire.setIn(UUID, initRemoteFork(UUID, filename));
}

function forwardRemoteCall(UUID, { identifier, result })
{
    const remoteCall = RemoteRequire
        .getIn(["forks", UUID, "calls", identifier]);
    const [resolved, [serialization, value]] = result;
    const timeoutID = remoteCall.timeoutID;

    clearTimeout(timeoutID);

    const method = resolved ? "resolve" : "reject";
    const settle = remoteCall[method];

    const deserialized = serialization === 0 ?
        value : Object.assign(new Error(value.name), value);

    settle(deserialized);

    RemoteRequire = RemoteRequire
        .removeIn(["forks", UUID, "calls", identifier]);
}

