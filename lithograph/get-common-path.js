module.exports = paths => paths
    .map(path => path.split("/"))
    .sort((lhs, rhs) => lhs.length - rhs.length)
    .reduce((commonPath, path) => commonPath === null ?
        path :
        path.slice(0, commonPath.findIndex((component, index) =>
            component !== path[index])), null)
    .join("/") + "/";