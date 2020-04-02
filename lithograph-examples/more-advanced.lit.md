# This is a Test Suite

You can create resources with quotes:

> *test.html*
> ```html
> <title>hi!</title>
> <body>hello.</body>
> ``

This resource will be available to any children.

## Use a resource

```javascript
const page = await (await getBrowserContext()).newPage();

await page.static(resource `test.html`);
expect(await page.title()).toEqual("hi!");
```

## Suites can have "implicit" tests

This code below is treated as if it were a serial precursor to
child tests, so it will run first and block the rest of the tests,
despite them being concurrent (to eachother).

```javascript
function x()
{
    return 5;
}
```

### Test 1

As always in Serial cases, x is available to our scope.

```javascript
expect(x()).toEqual(5);
```

### Test 1

```javascript
expect(x() + 1).toEqual(6);
```