## Test For Not Found URL

```javascript (templated)
const { stringify } = require("querystring");
const query = stringify({ url: {%notFoundURL%}, format:"json" });
const oembedURL = `${{%specification.APIEndpoint%}}?${query}`;
const response = await fetch(oembedURL);

if (response.status !== 404)
    throw Error(
        `Expected ${oembedURL} to return a status code of 404, ` +
        `but instead got ${response.status}`);
```
