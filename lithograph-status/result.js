const { data, union, string, number } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Node = require("@lithograph/ast");

const result = ([name]) => 
    (testFields, suiteFields) => union([name]) (
        data `Test` (
            ...testFields,
            test => Node.Test ),
        data `Suite` (
            ...suiteFields,
            suite => Node.Suite) );

const Reason = union `Reason` (
    data `Exception` (
        stack => string,
        message => string ),

    data `Value` ( stringified => string ) );

const Duration = data `Duration` (
    start => number,
    end => number );
    

const Result = union `Result` (
    result `Skipped` (
        [origin => number],
        [origin => number, children => List(Skipped)]),

    result `Omitted` (
        [origin => number],
        [origin => number, children => List(Omitted)]),

    result `Success` (
        [duration => Duration],
        [children => List(union `Passed` (Result.Success, Result.Skipped))]),
    
    result `Failure` (
        [duration => number, reason => Reason],
        [duration => number, children => List(Result) ]) );

Result.Duration = Duration;
Result.Failure.Reason = Reason;

module.exports = Result;
