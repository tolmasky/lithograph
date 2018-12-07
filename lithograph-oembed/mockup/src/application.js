const React = require("react");
const { List, Record } = require("immutable");

const OEmbed = require("./oembed");
const LoremIpsum = React.createElement(require("./lorem-ipsum"));
const InputBar = require("./input-bar");
const Placeholder = <div/>;


const Application = Object.assign(props => Application[props.data.state](props),
{
    Data: Record({ state:"initial", URL:"", interactive: true, items: null, input:"" }),

    initial({ data: { URL }, keyPath, update })
    {
        const params = new URLSearchParams(URL.split("?")[1]);
        const interactive = params.has("items");
        const encoded = interactive ?
            params.getAll("items") :
            ["0", Placeholder, "0"];
        console.log(encoded);
        const items = List(encoded.map(
            item => item === Placeholder ?
                Placeholder :
                item === "0" ?
                    LoremIpsum :
                    OEmbed.Data({ URL: item })));

        update(keyPath, data =>
            data.set("state", "loaded")
                .set("items", items)
                .set("interactive", interactive));

        return <div/>;
    },

    loaded: ({ data: { items, interactive, input }, keyPath, update }) =>
    {
        const onOEmbedURLChange = URL =>
            update([...keyPath, "items", 1], () => OEmbed.Data({ URL }));

        return  <div id = "page">
                    <InputBar   data = { input }
                                keyPath = { [...keyPath, "input"] }
                                update = { update }
                                action = { onOEmbedURLChange } />
                    {
                        items.map((item, index) =>
                            !(item instanceof OEmbed.Data) ?
                                item :
                                <OEmbed
                                    keyPath = { [...keyPath, "items", index] }
                                    update = { update }
                                    data = { item } />)
                    }
                </div>;
    }
});

module.exports = Application;
