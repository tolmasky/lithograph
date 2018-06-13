global = window;

const mock = require("jest-mock");
const expect_ = require("expect");
const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));

function expect(...args)
{
    const expectation = expect_(...args);

    expectation.eventually = Object
        .keys(expectation)
        .reduce((matchers, key) =>
            (matchers[key] = async (...args) =>
            {
                while (true)
                {
                    try
                    {
                        return await expectation[key](...args);
                    }
                    catch (error) { }

                    await delay(50);
                }
            }, matchers),
            Object.create(null));

    return expectation;
}

window.jest =
window.lithograph =
{
    fn: (...args) => mock.fn(...args),
};
window.expect = expect;
