const { Record } = require("immutable");

module.exports = function (subtypes, fields, name)
{
    const toConstructor = subtype => Object.assign(
        fields => Type({ ...fields, subtype:Type[subtype] }),
        { identifier: subtype },
        { toJS: () => subtype },
        { toString: () => `[${subtype}]` });
    const constructors = subtypes.map(toConstructor);
    const Type = Object.assign(
        Record({ subtype:-1, ...fields }, name),
        { subtypes: constructors },
        ...constructors.map(constructor =>
            ({ [constructor.identifier]: constructor })));

    return Type;
};
