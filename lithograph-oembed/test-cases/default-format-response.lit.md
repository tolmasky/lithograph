## Test Default Format Response

```javascript (templated)
const { stringify } = require("querystring");
const query = stringify({ url: {%URL%} });
const oembedURL = `${{%specification.APIEndpoint%}}?${query}`;
const response = await fetch(oembedURL);

if (response.status !== 200)
    throw Error(
        `Expected ${oembedURL} to return a status code of 200 since the ` +
        `"format" query parameter is optional, and thus a default format of ` +
        `${{%specification.defaultFormat%}} should have been inferred.\n` +
        `Instead got ${response.status}`);

const contentType = response.headers.get("content-type");
const isJSON = /^application\/json(;|$)/.test(contentType);

if (!isJSON)
    throw Error(
        `Expected ${oembedURL} to have a content-type of ` +
        `"application/json", but instead got ${contentType}.`);

const body = await response.json();

expect(body.provider_url).toBe({%specification.providerURL%});
//expect(body.height).toBe(329);
expect(body.width).toBe({%width%});
expect(body.version).toBe("1.0");
expect(body.provider_name).toBe({%specification.providerName%});
expect(body.type).toBe({%type%});

if ({%type%} === "rich")
{
    expect(body).toHaveProperty("html")
    expect(body.html)
        .toEqual(expect.stringMatching(/^<iframe/i));
}
```
