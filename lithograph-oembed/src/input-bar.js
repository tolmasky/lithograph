const React = require("react");


module.exports = ({ data, update, keyPath, action }) =>
{
    const onChange = event => update(keyPath, () => event.target.value);
    const onKeyPress = event => event.key === "Enter" ? action(data) : true;

    return  <div style = { InputBarStyle } >
                <input  type = "text"
                        style = { InputBarInputStyle }
                        value = { data }
                        placeholder = "OEmbed-compatible URL"
                        onChange = { onChange }
                        onKeyPress = { onKeyPress } />
            </div>
}

const InputBarStyle =
{
    backgroundColor: "#fff",
    height: "44px",
    verticalAlign: "top",
    borderRadius: "2px",
    boxShadow: "0 2px 2px 0 rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.08)",
    transition: "box-shadow 200ms cubic-bezier(0.4, 0.0, 0.2, 1)",
    marginBottom: "50px"
};

const InputBarInputStyle =
{
    font: "16px arial, sans-serif",
    lineHeight: "34px",
    height: "34px !important",
    border: "none",
    padding: "6px 9px 4px 9px",
    margin: "0px",
    width: "calc(100% - 18px)",
    outline: "none"
};
