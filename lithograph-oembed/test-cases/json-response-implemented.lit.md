## Test For Correct JSON Response

```javascript (templated)
const { stringify } = require("querystring");
const query = stringify({ url: {%URL%}, format:"json" });
const oembedURL = `${{%specification.APIEndpoint%}}?${query}`;
const response = (await (await fetch(oembedURL)).json());

expect(response.provider_url).toBe({%specification.providerURL%});
//expect(response.height).toBe(329);
console.log(`${{%specification.APIEndpoint%}}?${query}`);
expect(response.width).toBe({%width%});
expect(response.version).toBe("1.0");
expect(response.provider_name).toBe({%specification.providerName%});
expect(response.type).toBe({%type%});
console.log(Object.keys(expect));
if ({%type%} === "rich")
{
    expect(response).toHaveProperty("html")
    expect(response.html)
        .toEqual(expect.stringMatching(/^<iframe/i));
}
```