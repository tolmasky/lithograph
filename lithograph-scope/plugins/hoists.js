
module.exports = function hoists()
{
    const visitor =
    {
        Program(path, state)
        {
            state.file.metadata.declarations =
            {
                tdz: new Set(),
                vars: []
            }
        },

        FunctionDeclaration(path, state)
        {
            const { node } = path;
            const { id } = node;

            node.type = "FunctionExpression";
            state.file.metadata.declarations.vars.push([id.name, node]);

            path.replaceWith(id);
        }
    };

    return { visitor };
}
