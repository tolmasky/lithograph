const headers = length =>
({
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": length
});


module.exports = require("http")
    .createServer(function (request, response)
    {
        if (request.method !== "POST")
        {
            response.writeHead(404, headers("Not Found".length));
            return response.end("Not Found");
        }

//        response.writeHead(200, headers(request.headers["content-length"]));
        request.pipe(response);
    })
    .listen("9999");
