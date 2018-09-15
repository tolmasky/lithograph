const ErrorRegExp = /(?:(?:^Error\n\s+)|(?:\n\s+))at\s+/;
const FrameRegExp = /\(([^\(]+):(\d+):(\d+)\)$/;
const toInt = string => parseInt(string, 10);

///^Error\n(?:\s+at[^\n]+\n){2}\s+at\s+([^\(]+\(([^\)]+)[^\n]+)/;
const LocationRegExp = /^.+\:\d+\:\d+$/;


module.exports = function getFrames(name)
{
    const { stackTraceLimit } = Error;
    Error.stackTraceLimit = Infinity;
    const frames = Error().stack.split(ErrorRegExp)
        .map(frame => frame.match(FrameRegExp))
        .filter(frame => !!frame)
        .map(([, filename, line, column]) =>
            ({ filename, line: toInt(line), column: toInt(column) }))
        .slice(1);
    Error.stackTraceLimit = stackTraceLimit;

    return frames;
}
