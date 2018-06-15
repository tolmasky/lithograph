const { fork } = require("child_process");
const { Map, EmptyMap = Map(), Record } = require("immutable");

const RemoteCall = Record({ resolve:0, reject:0, timeoutID: -1 });
const RemoteFork = Record({ env:null, filename:"", process:0, calls: EmptyMap, nextCall:0 });
let RemoteRequire = Record({ forks: EmptyMap, exited: false, exports: EmptyMap })();


module.exports = function (filename, env)
{
    const UUID = JSON.stringify({ filename, env });

    if (!RemoteRequire.exports.has(UUID))
        RemoteRequire = RemoteRequire
            .setIn(["forks", UUID], initRemoteFork(UUID, filename, env))
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

function initRemoteFork(UUID, filename, env)
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

    const forked = Object.keys(listeners).reduce(
        (forked, event) => forked.on(event, listeners[event]),
        fork(`${__dirname}/forked-wrapper.js`, [filename],
            Object.assign(process.env, env)));

    forked.unref();
    forked.channel.unref();

    return RemoteFork({ env, filename, process: forked, listeners });
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
        RemoteRequire.setIn(UUID, initRemoteFork(UUID, filename, env));
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

