const t = require("babel-types");
const syscall = require("./syscall");


module.exports = function declarationsToYield()
{
    const visitor =
    {
        VariableDeclaration(path, state)
        {
            const { node: { kind, declarations }, scope } = path;
            
            if (kind !== "var" && !t.isFile(scope.parent.parentBlock))
                return;

            const [names, expression] =
                assignmentsFromVariableDeclaration(kind, declarations);
            const { metadata } = state.file;

            const add = kind === "var" ?
                name => metadata.declarations.vars.push([name]) :
                name => metadata.declarations.tdz.add(name);

            names.map(add);

            return path.replaceWith(expression);
        }
    };

    return { visitor };
}

function assignmentsFromVariableDeclaration(kind, declarations)
{
    const [names, expressions] = declarations
        .reduce(function ([names, expressions], { id, init })
        {        
            const keys = variableNamesFromPattern(id);
            const expression = kind === "var" ?
                init ?
                    t.assignmentExpression("=", id, init) :
                    patternToExpression(id) :
                t.AssignmentExpression("=", id,
                    syscall("declare", { kind, keys, init }));

            return [[...names, ...keys], [...expressions, expression]];
        }, [[], []]);

    return expressions.length === 1 ?
        [names, expressions[0]] :
        [names, t.sequenceExpression(expressions)];
}

function patternToExpression(pattern)
{
    if (t.isIdentifier(pattern))
        return pattern;

    if (t.isArrayPattern(pattern))
        return t.arrayExpression(R.map(patternToExpression, pattern.elements));

    if (t.isObjectPattern(pattern))
        return t.objectExpression(pattern.properties.map(
            ({ key, value }) => t.objectProperty(key, patternToExpression(value))));

    if (t.isAssignmentPattern(pattern))
        return t.assignmentExpression("=", patternToExpression(pattern.left), pattern.right);

    if (t.isRestElement(pattern))
        return t.SpreadElement(patternToExpression(pattern.argument));

    throw new Error("Unknown Pattern");
}

function variableNamesFromPattern(pattern)
{
    if (t.isIdentifier(pattern))
        return [pattern.name];

    if (t.isArrayPattern(pattern))
        return [].concat(...pattern.elements
            .filter(element => element !== null && element !== undefined)
            .map(variableNamesFromPattern));

    if (t.isAssignmentPattern(pattern))
        return variableNamesFromPattern(pattern.left);

    if (t.isRestElement(pattern))
        return variableNamesFromPattern(pattern.argument);

    return [].concat(...pattern.properties
        .map(({ value }) => variableNamesFromPattern(value)));
}

