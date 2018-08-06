const { List } = require("immutable");
const SubtypedRecord = require("./subtyped-record");

module.exports = SubtypedRecord(
    ["Concurrent", "Serial"],
    { title:"", disabled:false, children:List() },
    "Suite");
