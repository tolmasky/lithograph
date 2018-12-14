const MDASTToHAST = require("mdast-util-to-hast");
const all = require("mdast-util-to-hast/lib/all");
const options = { handlers: { Section: fromSection } };
const HASTToHTML = require("hast-util-to-html");


function fromSection(h, section)
{
    const { preamble, subsections, heading } = section;
    const title = heading ? [heading] : [];
    const children = title.concat(preamble.toArray(), subsections.toArray());

    return h(section, "section", all(h, { children }));
}

module.exports = function toHTML(section)
{
    return HASTToHTML(MDASTToHAST(section, options));
}
