const { List, Map, Record } = require("immutable");
const { inspect } = require("util");
const Constant = name => ({ [inspect.custom]: () => name });

const Source = require("./source");

const Metadata = Record(
{
    id: "",
    title:"",
    depth: -1,
    disabled: false,
    resources: Map()
}, "Metadata");

const Concurrent = Constant("Concurrent");
const Serial = Constant("Serial");
const Suite = Record(
{
    mode:Concurrent,
    source: Source(),
    metadata:-1,
    children:List()
}, "Suite");

Suite.Concurrent = Concurrent;
Suite.Serial = Serial;

const Fragment = Record({ source:-1, value:"" }, "Fragment");
const Test = Record({ source:-1, metadata:-1, fragments:List() }, "Test");

module.exports = { Metadata, Suite, Test, Fragment, Source };

module.exports.fromMarkdown = function fromMarkdown (filename)
{
    return require("./from-markdown")(filename);
}
