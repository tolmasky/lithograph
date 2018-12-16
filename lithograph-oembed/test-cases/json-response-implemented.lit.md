## Test For Correct JSON Response

```javascript (templated)
const URL = {%URL%};
const APIEndpoint = {%specification.APIEndpoint%};
const validate = require(`${{%dirname%}}/validate`);

if (!validate({%specification.URLSchemes%}, URL))
{
console.log("ABOUT TO THROW", {%specification.URLSchemes%}, `[${{%URL%}}]`);
    throw Error(`${URL} does not match the URL scheme for ${APIEndpoint}.`);
}
const { stringify } = require("querystring");
const query = stringify({ url: {%URL%}, format:"json" });
const oembedURL = `${{%specification.APIEndpoint%}}?${query}`;
const body = (await (await fetch(oembedURL)).json());

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
