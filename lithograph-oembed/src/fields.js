const React = require("react");


module.exports = ({ style, data }) =>
    <ul style = { { ...FieldsULStyle, ...style } } >
    {
        data.keySeq().map((key, index) =>
            <li key = { key } style = { FieldsLIStyle } >
                <Field label = { key } value = { data.get(key) } />
            </li>)
    }
    </ul>;

const FieldsULStyle =
{
    padding:0,
    border:0,
    margin:0,
    listStyleType: "none",
    display: "block",
    fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`
}
const FieldsLIStyle =
{
    display: "block"
}

const Field = ({ label, value }) =>
    [
        <span style = { FieldLabelStyle } >{ label }:</span>,
        <input value = { value } style = { FieldValueStyle } />
    ];

const FieldLabelStyle =
{
    width: "50%",
    display: "inline-block",
    fontWeight: "bold",
    textAlign: "right"
}
const FieldValueStyle =
{
    width: "calc(50% - 10px)",
    display: "inline-block",
    textAlign: "left",
    marginLeft: "10px",
    boxSizing: "border-box",
    overflow:"hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
}
