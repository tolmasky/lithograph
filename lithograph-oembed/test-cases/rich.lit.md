## Ensure rich oembed create usable HTML

```javascript (templated)
const site = require("@lithograph/static-site");
const query = [0, {%URL%}, 0]
    .reduce((params, value) =>
        (params.append("items", value), params),
        new URLSearchParams()) + "";
const mediumURL = `https://medium.com?${query}`;
const sites = { "https://medium.com": `${{%dirname%}}/mockup` };


const browser = await getBrowserContext();
const page = await site(browser, sites, mediumURL);
await new Promise(resolve => {});
/*
page.try_url({%URL%}, {%type%});

const page = await (await getBrowserContext()).static(html);
const embed = page.mainFrame().childFrames()[0];

// This is a bit of a hack, but we need a way to know when the embed is loaded.
// We can't use embed.wait.for.load() since there's no external mechanism for
// listening to messages.
await embed.waitForSelector(`div[data-queriable-cell="0"]`);

expect(embed).not.toBeFalsy();
expect(await embed.notebook.cell(0).text())
    .toBe([1, 2, 3, 4].map(index => `console.log(${index})`).join("\n"));*/
```
