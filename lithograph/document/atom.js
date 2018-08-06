const { List, Record } = require("immutable");

const Block = Record({ text:"" }, "Block");
const Atom = Record({ blocks:List() }, "Atom");

module.exports = Object.assign(Atom, { Atom, Block });
