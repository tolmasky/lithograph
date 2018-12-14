const HASTToHTML = require("hast-util-to-html");


module.exports = function toHTML(hast)
{
    return HASTToHTML(hast);
}
