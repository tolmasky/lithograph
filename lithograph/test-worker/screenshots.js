const { spawnSync } = require("child_process");


module.exports = async function (browser, screenshotsPath)
{
    try
    {
        const pages = await browser.pages();

        if (pages.length <= 0)
            return;

        spawnSync("mkdir", ["-p", screenshotsPath]);

        const results = await Promise.all(pages
            .map((page, index) => [page, `${screenshotsPath}/page-${index}.png`])
            .map(([page, path]) => page.screenshot({ path })
                .then(() => path)
                .catch((e) => console.log(e))));

        console.log(results);
    }
    catch (error)
    {console.log(error);
    }
}
