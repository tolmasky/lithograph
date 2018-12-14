const { openSync: open, writeSync: write, closeSync: close } = require("fs");

const UndefinedTag  = new Int8Array([0]);
const NullTag       = new Int8Array([1]);
const TrueTag       = new Int8Array([2]);
const FalseTag      = new Int8Array([3]);
const StringTag     = new Int8Array([4]);
const DoubleBETag   = new Int8Array([5]);
const ArrayTag      = new Int8Array([6]);
const ObjectTag     = new Int8Array([7]);

const { isArray } = Array;


module.exports = function _(filename, value)
{
    const fd = open(filename, "wx");

    writeValue(fd, value);
    close(fd);
}

function writeValue(fd, value)
{
    return  value === void(0) ? write(fd, UndefinedTag) :
            value === null ? write(fd, NullTag) :
            value === true ? write(fd, TrueTag) :
            value === false ? write(fd, FalseTag) :
            typeof value === "string" ? writeString(fd, value) :
            typeof value === "number" ? writeDoubleBE(fd, value) :
            isArray(value) ? writeArray(fd, value) :
            writeObject(fd, value);
}

const writeDoubleBE = (function ()
{
    const buffer = Buffer.alloc(9);

    buffer.writeUInt8(DoubleBETag[0]);

    return function writeDoubleBE(fd, number)
    {
        buffer.writeDoubleBE(number, 1);

        write(fd, buffer);
    }
})();

function writeString(fd, string)
{
    write(fd, StringTag);
    writeUInt32BE(fd, string.length);

    write(fd, string, "utf-8");
}

function writeArray(fd, array)
{
    write(fd, ArrayTag);
    writeUInt32BE(fd, array.length);

    for (const item of array)
        writeValue(fd, item);
}

function writeObject(fd, object)
{
    const keys = Object.keys(object);

    write(fd, ObjectTag);
    writeUInt32BE(fd, keys.length);

    for (const key of keys)
    {
        writeString(fd, key);
        writeValue(fd, object[key]);
    }
}

const writeUInt32BE = (function ()
{
    const buffer = Buffer.alloc(4);

    return function writeUInt32BE(fd, value)
    {
        buffer.writeUInt32BE(value);

        write(fd, buffer);
    }
})();
