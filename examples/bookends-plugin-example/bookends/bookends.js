const { data, union, boolean, string, number, parameterized } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Section = require("@lithograph/ast/section");

const prologue = Section.fromMarkdown(`${__dirname}/prologue.template.md`);
const epilogue = Section.fromMarkdown(`${__dirname}/prologue.template.md`);

    // Remark heading

const toRemarkHeading = value =>
    ({ type: "heading", depth:0, children:[{ type: "text", value }] });
const SectionList = List(Section)

module.exports = function (section)
{
    return Section(
    {
        depth: 0,
        heading: toRemarkHeading("Wrapper (Sequential)"),
        subsections: SectionList(
        [
            prologue,
            section,
            epilogue
        ])
    });
}
