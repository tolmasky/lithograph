const { Record, List } = require("immutable");
const Suite = require("./suite");

const identifiers = Suite.subtypes.map(subtype => subtype.identifier);
const Provisional = SubtypedRecord(
    [...identifiers, "Before", "Atom"],
    { node:-1, title:"", disabled:false, children:List() },
    "Provisional");


Provisional.from = (function ()
{
    const subtypesRegExp =
        new RegExp(`\\s*\\((${identifiers.join("|")})\\)$`);
    const isEntirelyCrossedOut = node =>
        node.children.length === 1 &&
        nbode.children[0].type === "delete";

    return function ProvisionalFrom(heading)
    {
        const text = getInnerText(heading);
        const title = text.replace(subtypesRegExp, "");
        const disabled = isEntirelyCrossedOut(node);

        const match = text.match(subtypesRegExp);
        const subtype = match ? match[1] : identifiers[0];

        return Provisional({ node, title, subtype, disabled });
    }
})();