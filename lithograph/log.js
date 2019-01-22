const { data, string } = require("@algebraic/type");

const Log = data `Log` (message => string);

module.exports = Log;
