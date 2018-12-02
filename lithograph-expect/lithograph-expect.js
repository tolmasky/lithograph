const mock = require("jest-mock");
const jestExpect = require("expect");
const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));


module.exports.mock = mock;

module.exports.expect = function expect(expected)
{/*
    Object.assign(jestExpect(expected),
    {
        
    });*/
    const expectation = jestExpect(expected);

    expectation.eventually = Object
        .keys(expectation)
        .reduce((matchers, key) =>
            (matchers[key] = async (received) =>
            {
                try { await expected; } catch (e) { }

                while (true)
                {
                    try
                    {
                        if (expected && typeof expected.rerun === "function")
                            return await jestExpect(await expected.rerun())[key](received);

                        return await expectation[key](...received);
                    }
                    catch (error) { }

                    await delay(50);
                }
            }, matchers),
            Object.create(null));

    return expectation;
}

Object.keys(jestExpect).map(key => module.exports.expect[key] = jestExpect[key]);
