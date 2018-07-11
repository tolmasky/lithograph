const React = require("react");
const { Record } = require("immutable");


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

    const __html = data.result.iframe.outerHTML;
    const id = JSON.stringify(keyPath);
    const height = data.height;
    const style = Object.assign({ }, IFrameContainerStyle, { height });

    return  <div id = { id } style = { style } >
                <div    style = { { height:"100%", width: "100%" } }
                        dangerouslySetInnerHTML = { { __html } } />
            </div>
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

    const value = await response.json();
    
    if (!value.html)
        throw new Error(
            `OEmbed response must contain an "html" property.`);
 
    const fragment = Object.assign(
        document.createElement("div"),
        { innerHTML: value.html });

    if (fragment.childNodes.length !== 1 ||
        !fragment.firstElementChild ||
        fragment.firstElementChild.tagName !== "IFRAME")
        throw new Error("OEmbed HTML must contain one iframe element.");

    const iframe = Object.assign(
        fragment.firstElementChild,
        { style: "" });

//    if (parseInt(iframe.width, 10) !== iframe.width)
//        throw new Error(`OEmbed IFrame "width" attribute must be an integer.`);

//    if (parseInt(iframe.height, 10) !== iframe.height)
//        throw new Error(`OEmbed IFrame "height" attribute must be an integer.`);

    iframe.width = "100%";
    iframe.height = "100%";

    return { iframe, response };
}
