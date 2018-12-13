## Ensure rich oembed create usable HTML

```javascript (templated)
const site = require("@lithograph/static-site");
const URL = {%URL%};
const query = [0, URL, 0]
    .reduce((params, value) =>
        (params.append("items", value), params),
        new URLSearchParams()) + "";
const mediumURL = `https://medium.com?${query}`;
const sites = { "https://medium.com": `${{%dirname%}}/mockup` };

const browser = await getBrowserContext();
const page = await site(browser, sites, mediumURL);
const iframeSelector = "#items-1 iframe";

await page.waitForSelector(iframeSelector);

const iframeElement = await page.$("#items-1 iframe");
const iframeFrame = await iframeElement.contentFrame();

await ({%onReady%})(iframeFrame, URL);
```
