## Test For Missing URL Query Parameter

```javascript (templated)
const { stringify } = require("querystring");
const query = stringify({ format:"json" });
const oembedURL = `${{%specification.APIEndpoint%}}`;
const response = await fetch(oembedURL);

if (response.status !== 400)
    throw Error(
        `Expected ${oembedURL} to return a status code of 400 since it does ` +
        `not implement provide a "url" query paramemter.\n` +
        `Instead got ${response.status}`);
```
