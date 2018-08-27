const { isProgram } = require("babel-types");

module.exports = function skipFunctions()
{
    const visitor =
    {
//        Function: path =>
//            !isProgram(path.getFunctionParent().node) && path.skip()
    };

    return { visitor };
}