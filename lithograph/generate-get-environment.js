const { Map } = require("immutable");
const mock = require("jest-mock");
const jestExpect = require("expect");
const fetch = require("node-fetch");
const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));
require("./magic-ws-puppeteer");
global.fetch = fetch;
require("./test-worker/static");

module.exports = function generateGetEnvironment(push)
{
    const FileProcess = require("./file-process");
    const template = { getBrowser, getBrowserContext, mock, expect };
    const getEnvironment = () => Map(Object.keys(template)
        .map(key => [key, (...args) => template[key](...args)]))
        .toObject();
    const event = FileProcess.GeneratedGetEnvironment({ getEnvironment });

    push(event);

    async function getBrowserContext()
    {
        return await (await getBrowser(push))
            .createIncognitoBrowserContext();
    }

    async function getBrowser()
    {
        const browserWSEndpoint = await new Promise((resolve, reject) =>
            push(FileProcess.GetBrowserCalled({ resolve, reject })));

        return await require("puppeteer").connect({ browserWSEndpoint });
    }
}

function expect(expected)
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

                        return await expectation[key](received);
                    }
                    catch (error) { }

                    await delay(50);
                }
            }, matchers),
            Object.create(null));

    return expectation;
}


