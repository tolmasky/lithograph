const { Record, Map } = require("immutable");
const namespaced = namespace =>
    (fields, name) => Record(fields, `${namespace}.${name}`);
const fromMaybeTemplate = input =>
    typeof input === "string" ? input : input[0];

const Event = Object.assign(
    typename => (fields, name) =>
        Event.map[Event.count] = Object.assign(
            Record(fields, `${typename}.${name}`),
            { id: Event.count++ }),
    { count: 0, map: [] });

module.exports = Object.assign(Cause,
{
    Cause,
    field: declaration("field", "name"),
    event:
    {
        in: declaration("event.in", "name"),
        out: declaration("event.out", "name"),
        on: declaration("event.on", "on", { from:-1 }),
        expose: declaration("event.on", "expose", { from:-1 }),
        from: declaration("event.on", "from")
    }
});

function Cause(nameOrArray, declarations)
{
    if (arguments.length < 2)
        return declarations => Cause(nameOrArray, declarations);

    const typename = fromMaybeTemplate(nameOrArray);
    const definitions = List(Object.keys(declarations))
        .filter(key => key.charAt(0) === "{")
        .map(key => [JSON.parse(key), declarations[key]])
        .groupBy(([{ kind }]) => kind);

    const toObject = (key, transform = x => x) =>
        (pairs => Map(pairs).toObject())
        ((definitions.get(key) || List())
            .map(([parsed, value]) =>
                [parsed.name, transform(value, parsed.name)]));

    const init = declarations["init"];
    const create = (...args) => 
        type(...(init ? [init(...args)] : args));
    const fields = toObject("field");
    const eventsIn = toObject("event.in", Event(typename));
    const eventsOut = toObject("event.out", Event(typename));
    const type = Record(fields, typename);
    const update = toCauseUpdate(definitions
        .get("event.on")
        .map(toEventUpdate(eventsIn)));

    Object.defineProperty(type, "name", { value: typename });

    return Object.assign(type, { create, update }, eventsIn, eventsOut);
}

function toEventUpdate(eventsIn)
{
    return function ([{ on, expose, from }, value])
    {
        const event = on || expose;
        const id = !!event && event !== "*" &&
            (event.charAt(0) === ":" ?
                event.substr(1) :
                eventsIn[event].id);
        const update = !expose && value;

        return { id, from: from && [].concat(from), update, expose: !!expose };
    }
}

function toCauseUpdate(handlers)
{
    return function update(state, event, source)
    {
        const id = Object.getPrototypeOf(event).constructor.id;
        const match = handlers.find(handler =>
            (handler.id === "*" || handler.id === id) &&
            (!handler.from || state.getIn(handler.from) === source));

        if (!match)
            throw new Error("!!!");

        const result = match.update(state, event, source);

        return Array.isArray(result) ? result : [result, []];
    }
}

function declaration(previous, key, routes = { })
{
    const rest = typeof previous === "string" ?
        { kind: previous } : previous;
    const toObject = value =>
        ({ ...rest, [key]: fromMaybeTemplate(value) });
    const f = value => Object.keys(routes)
        .reduce((object, key) => Object.assign(object,
            { [key]: declaration(toObject(value), key, routes[key]) }),
            { toString: () => JSON.stringify(toObject(value)) });

    return Object.assign(f, f("*"));
}
