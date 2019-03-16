## Ensure rich oembed create usable HTML

```javascript (templated)
const proxy = require("@lithograph/proxy");
const URL = {%URL%};
const query = [0, URL, 0]
    .reduce((params, value) =>
        (params.append("items", value), params),
        new URLSearchParams()) + "";
const mediumURL = `https://medium.com?${query}`;

const browserContext = await getBrowserContext();
const page = await proxy(browserContext,
    proxy.mount("https://medium.com", `${{%dirname%}}/mockup`),
    proxy.all("*anything", proxy.allow));

await page.goto(mediumURL);

const iframeSelector = "#items-1 iframe";

await page.waitForSelector(iframeSelector);

const iframeElement = await page.$("#items-1 iframe");
const iframeFrame = await iframeElement.contentFrame();

await ({%onReady%})(iframeFrame, URL);
```
