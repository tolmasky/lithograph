const React = require("react");
const { Record } = require("immutable");


const OEmbed = Object.assign(props => OEmbed[props.data.state](props),
{
    Data: Record({ state:"initial", URL:"", response: null }),

    initial({ data: { URL }, keyPath, update })
    {
        fetchOEmbed({ URL, maxwidth:700 })
            .then(value => update(keyPath, data =>
                data.set("state", "loaded")
                    .set("response", value)))
            .catch(value => update(keyPath, data =>
                data.set("state", "errored")
                    .set("response", value)));

        update(keyPath, data => data.set("state", "loading"));

        return <section className = "oembed loading" />;
    },

    loading: () => <section className = "oembed loading" />,

    errored: () => <section>ERROR!</section>,

    loaded: ({ data: { response: { html: __html } } }) =>
        <section className = "oembed" dangerouslySetInnerHTML = { { __html } } />
        
});

module.exports = OEmbed;

async function fetchOEmbed({ URL, maxwidth })
{console.log("FETCHING " + URL);
    const format = "json";
    const query = [["url", URL], ["format", format], ["maxwidth", maxwidth]]
        .reduce((params, [key, value]) =>
            (params.append(key, value), params),
            new URLSearchParams()).toString();
    const oembedURL = `https://embed.tonic.work/oembed?${query}`;
    const response = await fetch(oembedURL);
    
    if (response.status !== 200)
        throw Object.assign(new Error(), { status });

    return await response.json();
}
