## Test Correct JSON Response

```javascript (templated)
const { stringify } = require("querystring");
const query = stringify({ url: {%URL%}, format:"json" });
const oembedURL = `${{%specification.APIEndpoint%}}?${query}`;
const response = (await (await fetch(oembedURL)).json());

expect(response.provider_url).toBe({%specification.providerURL%});
//expect(response.height).toBe(329);
expect(response.width).toBe(900);
expect(response.version).toBe("1.0");
expect(response.provider_name).toBe({%specification.providerName%});
expect(response.type).toBe("rich");
```
