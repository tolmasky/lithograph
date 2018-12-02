const { statements } = require("@babel/template");
const { string } = require("@algebraic/type");
const { Map } = require("@algebraic/collections");

const prefix = "FIXME_TEMPLATE_";


module.exports = function (templateArguments = false)
{
    if (templateArguments === false) 
        return node => node;

    return function (node)
    {
        const { type, meta, value } = node;

        if (type !== "code" ||
            meta !== "(templated)" ||
            value.indexOf("{%") === -1)
            return node;

        const fields = Object.keys(templateArguments);
        const union = fields.join("|");console.log(union);
        const code = value.replace(
            new RegExp(`{%(${union})%}`, "g"),
            (_, name) => `${prefix}${name}`);
        const replacements = Map(string, Object)
            (templateArguments)
                .mapEntries(([key, value]) => [`${prefix}${key}`, value.name]).toJS();
                console.log(code);
        const transformed = statements(code,
        {
            allowAwaitOutsideFunction: true,
            preserveComments: true,
            placeholderPattern: new RegExp(`^${prefix}${union}$`)
        })(replacements);

        return { ...node, value: transformed };
    }
}
    