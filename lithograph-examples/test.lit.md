# This is a Test Suite

Hello.

## Here is a passing test.

```javascript
expect(5).toEqual(5)
```

### Here is a failing test.

```javascript
expect(10).toEqual(11);
```

### ~~This test is disabled, so it won't fail~~

```javascript
expect(10).toEqual(11);
```

## Here are some browser tests

### And another test.

```javascript
// getBrowserContext will get you a new chrome instance
// When the test leaves scope, the browser instance will be
// garbage collected and put back in the pool, no need to
// "dealloc" or close.
// run with --no-headless to see this render.
const page = await (await getBrowserContext()).newPage();

await page.goto("https://google.com");

// Just use puppeteer's API.
expect(page.url()).toEqual("https://www.google.com/");
```

### By default, tests run in parallel

```javascript
// This test is running parallel to the other browser test.
const page = await (await getBrowserContext()).newPage();

await page.goto("https://apple.com");

// Just use puppeteer's API.
expect(page.url()).toEqual("https://www.apple.com/");
```

## But, you can run sequantial tests, by marking the parent suite (Serial)

### Now this test blocks the next.

```javascript
const page = await (await getBrowserContext()).newPage();

await page.goto("https://apple.com");

// Just use puppeteer's API.
expect(page.url()).toEqual("https://www.apple.com/");
```

### And so I can use variables created from before, unlike in parallel tests.

```javascript
expect(page.url()).toEqual("https://www.apple.com/");
```
