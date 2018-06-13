
const puppeteer = require('puppeteer');

(async function ()
{
    const browser = await puppeteer.launch({ headless: false, devtools: true });
    const page = await browser.newPage();
    
    await page.goto("https://www.google.com");
    try {
    await page.evaluate("(async function() { throw new Error('hello') })()");
}catch(e) { console.log(e) }
    console.log("hello");
})();
