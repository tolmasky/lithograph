const MDASTtoHAST = require("mdast-util-to-hast");
const all = require("mdast-util-to-hast/lib/all");
const options = { handlers: { Section: fromSection } };


function fromSection(h, section)
{
    const { preamble, subsections, heading } = section;
    const title = heading ? [heading] : [];
    const children = title.concat(preamble.toArray(), subsections.toArray());

    return h(section, "section", all(h, { children }));
}

module.exports = function toHAST(section)
{
    return MDASTtoHAST(section, options);
}
