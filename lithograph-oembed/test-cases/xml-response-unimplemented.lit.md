## Test For 501 XML Response

```javascript (templated)
const { stringify } = require("querystring");
const query = stringify({ url: {%URL%}, format:"xml" });
const oembedURL = `${{%specification.APIEndpoint%}}?${query}`;
const response = await fetch(oembedURL);

if (response.status !== 501)
    throw Error(
        `Expected ${oembedURL} to return a status code of 501 since it does ` +
        `not implement XML as a format option.\n` +
        `Instead got ${response.status}`);
```
