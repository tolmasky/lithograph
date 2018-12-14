const { number, data, string } = require("@algebraic/type");


const LitFile = data `LitFile` (
    id          => number,
    filename    => string );

module.exports = LitFile;
