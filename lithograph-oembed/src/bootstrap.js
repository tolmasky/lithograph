const React = require("react");
const ReactDOM = require("react-dom");

const Application = require("./application");
const root = document.getElementById("root");
const update = ((data, updating) => function update(...args)
{
    if (updating)
        return setTimeout(() => update(...args), 0);

    updating = true;

    if (args.length > 0)
        data = data.updateIn(...args);

    ReactDOM.render(
        <Application { ...{ data, update, keyPath:[] } } />, 
        root);
    
    updating = false;
})(Application.Data({ URL: window.location.href }));
        
update();
console.log("hello!");
