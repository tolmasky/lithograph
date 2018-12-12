const React = require("react");
const { Map, Record } = require("immutable");
const Fields = require("./fields");
const SystemFontFamily = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;


const OEmbed = Object.assign(props => OEmbed[props.data.state](props),
{
    Data: Record(
    {
        state:"initial",
        URL:"",
        result: null,
        error: null,
        height: 20,
        width: "100%"
    }),

    initial({ data: { URL }, keyPath, update })
    {
        fetchOEmbed({ URL, maxwidth:700 })
            .then(value => update(keyPath, data =>
                data.set("state", "loaded")
                    .set("result", value)))
            .catch(value => update(keyPath, data =>
                data.set("state", "errored")
                    .set("error", value)));

        update(keyPath, data => data.set("state", "loading"));

        return <section className = "oembed loading" />;
    },

    loading: () => <section className = "oembed loading" />,

    errored: ({ data: { error } }) => <section>{ error.message }</section>,

    loaded: ({ data, update, keyPath }) =>
        <section className = "oembed" >
            <OEmbedContainer { ...{ data, keyPath, update } } />
        </section>
});

const OEmbedContainer = function ({ data, keyPath, update })
{
    window.addEventListener("message", function ({ data })
    {
        const { context, height } = JSON.parse(data);

        if (context !== "iframe.resize")
            return;

        update([...keyPath, "height"], () => height);
    })

    const result = data.result;
    const __html = result.get("iframe").outerHTML;
    const id = keyPath.join("-");
    const width = data.width;
    const height = data.height;
    const style = Object.assign({ }, IFrameContainerStyle, { height });

    return  <div id = { id } style = { style } >
                <div style = { OEmbedCalloutStyle } />
                <div style = { OEmbedInfoStyle } >
                    <Fields data = { Map({ "dynamic-height": height }) } />
                    <Fields data = { result.get("JSON") } />
                </div>
                <div    style = { { height:"100%", width: "100%" } }
                        dangerouslySetInnerHTML = { { __html } } />
                <OEmbedSize width = { width } height = { height } />
            </div>
}

const OEmbedSize = function ({ width, height })
{
    const style =
    {
        color:"red",
        padding: "10px",
        textAlign: "center",
        fontFamily: SystemFontFamily,
        fontWeight: "bold"
    };

    return  <div style = { style } >
                <span className = "dynamic-width">{width}</span>
                &nbsp;×&nbsp;
                <span className = "dynamic-height">{height}</span>
            </div>;
}

const OEmbedCalloutStyle =
{
    position: "absolute",
    top: "-2px",
    width: "20px",
    right: "100%",
    borderTop: "2px dashed red"
}

const OEmbedInfoStyle =
{
    position: "absolute",
    top: "-2px",
    width: "270px",
    right: "100%",
    lineHeight: "1.58",
    marginRight: "20px",
    paddingRight: "20px",
    borderRight: "2px dashed red"
}

module.exports = OEmbed;

const IFrameContainerStyle =
{
    position: "relative",
    border: "2px dashed red",
    width: "calc(100% + 2px)",
    left: "-2px",
    top: "-2px"
}

async function fetchOEmbed({ URL, maxwidth })
{
    const format = "json";
    const query = [["url", URL], ["format", format], ["maxwidth", maxwidth]]
        .reduce((params, [key, value]) =>
            (params.append(key, value), params),
            new URLSearchParams()).toString();
    const oembedURL = `https://embed.tonic.work/oembed?${query}`;
    const response = await fetch(oembedURL);
    
    if (response.status !== 200)
        throw Object.assign(new Error(), { status });

    const JSON = await response.json();
    
    if (!JSON.html)
        throw new Error(
            `OEmbed response must contain an "html" property.`);
 
    const fragment = Object.assign(
        document.createElement("div"),
        { innerHTML: JSON.html });

    if (fragment.childNodes.length !== 1 ||
        !fragment.firstElementChild ||
        fragment.firstElementChild.tagName !== "IFRAME")
        throw new Error("OEmbed HTML must contain one iframe element.");

    const iframe = Object.assign(
        fragment.firstElementChild,
        { style: "" });

    if (parseInt(iframe.width, 10) + "" !== iframe.width)
        throw new Error(`OEmbed IFrame "width" attribute must be an integer.`);

    if (parseInt(iframe.height, 10) + "" !== iframe.height)
        throw new Error(`OEmbed IFrame "height" attribute must be an integer.`);

    iframe.width = "100%";
    iframe.height = "100%";

    return Map({ iframe, JSON: Map(JSON), response });
}
