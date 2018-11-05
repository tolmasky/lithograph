const { dirname, join, resolve } = require("path");
const { existsSync, readdirSync, writeFileSync } = require("fs");
const { hasOwnProperty } = Object.prototype;


const version = "1.0.0-alpha.6";
const packages = readdirSync(__dirname)
    .map(name => join(__dirname, name, "package.json"))
    .filter(path => existsSync(path))
    .map(path => [path, require(path)]);

console.log("Found the following packages: " + packages.map(info => info[1].name).join(", "));

for (const [path, info] of packages)
{
    info.version = version;

    for (const [path, dependency] of packages)
    {
        if (hasOwnProperty.call(info.peerDependencies || { }, dependency.name))
            info.peerDependencies[dependency.name] = version;
    
        if (hasOwnProperty.call(info.dependencies || { }, dependency.name))
            info.dependencies[dependency.name] = version;
    }

    writeFileSync(path, JSON.stringify(info, null, 2), "utf-8");
}

/*

    .filter(name => name !== "pre-publish" && name !== "isomorphic-bundle-js" && !name.startsWith("."))
    .map(name => compile(
    {
        root: relative(join("..", name)),
        cache,
        destination: join(destination, name)
    }));

execSync("npm install", { cwd: join(destination, "examples"), stdio:[0,1,2] });
execSync("npm install", { cwd: join(destination, "isomorphic"), stdio:[0,1,2] });
execSync("cp -r isomorphic examples/node_modules/", { cwd: destination, stdio:[0,1,2] });
execSync("node routes.js", { cwd: join(destination, "examples"), stdio:[0,1,2] });

console.log(`Completed at ${destination}`);*/