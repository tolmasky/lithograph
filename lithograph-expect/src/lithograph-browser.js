if (window.top !== window)
    return;

global = window;
window.expect = require("../lithograph-expect");
