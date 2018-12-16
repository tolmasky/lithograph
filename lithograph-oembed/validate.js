const Route = require("route-parser");
const toRoute = URL => new Route(URL.split("/")
    .map((pc, index) => pc === "*" ? `:${index}` : pc)
    .join("/"));
const toValidateURL = schemes =>
    (routes => URL =>
        routes.some(route => route.match(URL)))
    (schemes.toList().map(toRoute));

module.exports = function validate(schemes, URL)
{
    return schemes.map(toRoute).some(route => route.match(URL));
}
