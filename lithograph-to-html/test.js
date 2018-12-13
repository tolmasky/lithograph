const Section = require("@lithograph/ast/section");
const section = Section.fromMarkdown("/Users/tolmasky/Desktop/test-serial-1.lit.md");
const toHTML = require("mdast-util-to-hast");
const all = require("mdast-util-to-hast/lib/all");
const toHTMLString = require("hast-util-to-html");

const fromSection = function (h, section)
{
    const { preamble, subsections, heading } = section;
    const title = heading ? [heading] : [];
    const children = title.concat(preamble.toArray(), subsections.toArray());

    return h(section, "section", all(h, { children }));
}

console.log(toHTMLString(toHTML(section, { handlers: { Section: fromSection } })));

module.exports = function (section)
{
    
}