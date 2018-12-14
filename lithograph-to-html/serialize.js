const { data, deserialize, serialize, union, declare, string, getTypename, parameterized } = require("@algebraic/type");

module.exports.serialize = function (node)
{
    return serialize(Element, node);
}

const array = parameterized (T =>
{
    const typename = `array<${getTypename(T)}>`;
    const create = Array;
    const serialize = [(value, serialize) =>
        value.map(value => serialize(T, value)),
        false];
    const deserialize = (serialized, deserialize) =>
        type(serialized.map(serialized =>
            deserialize(T, serialized)));
    const is = Array.isArray;
    const type = declare({ typename, create, is, serialize, deserialize });

    return type;
});

const Node = function (t, data)
{
    const typename = `Node<${data}>`;
    const create = fields => ({ ...fields, type: t });
    const serialize = [(value, serialize) =>
        [value.properties, serialize(data, value)],
        false];
    const deserialize = (serialized, deserialize) =>
        create({ properties:serialized[0], ...deserialize(data, serialized[1]) });
    const is = value =>
        value &&
        typeof value === "object" &&
        value.type === t;
    const type = declare({ typename, create, is, serialize, deserialize });

    return type;
}

const Element = Node("element",
    data `Element` (
        tagName     => string,
        //properties  => Object,
        children    => array(union `Children` (Element, Text))));

const Text = Node("text",
    data `Text` (
        value       => string ));