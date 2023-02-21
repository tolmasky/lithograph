const { is, data, union, string, number, declare } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const { Test, Suite } = require("@lithograph/ast");


const result = ([name]) => 
    (testFields, suiteFields) => union([name]) (
        data `Test` (
            ...testFields,
            test => Test ),
        data `Suite` (
            ...suiteFields,
            suite => Suite) );

const Reason = union `Reason` (
    data `Error` (
        stack => string,
        message => [string, ""] ),

    data `Value` ( stringified => string ) );

const Duration = union `Duration` (
    data `Interval` (
        start => number,
        end => number ),
    data  `Instant` () );


const Result = union `Result` (
    result `Skipped` (
        [origin => number],
        [origin => number, children => List(Result.Skipped)]),

    result `Omitted` (
        [origin => number],
        [origin => number, children => List(Result.Omitted)]),

    result `Success` (
        [duration => [Duration, Duration.Instant]],
        [children => [List(Passed), List(Passed)()]]),

    result `Failure` (
        [duration => Duration, reason => Reason],
        [children => List(Result)]) );

const Passed = union `Passed` (Result.Success, Result.Skipped);

Result.Suite = union `Suite` (
    Skipped => Result.Skipped.Suite,
    Omitted => Result.Omitted.Suite,
    Success => Result.Success.Suite,
    Failure => Result.Failure.Suite );

Result.Suite.fromChildren = function (suite, children)
{
    const failed = children.some(is(Result.Failure));

    return failed ?
        Result.Failure.Suite({ suite, children }) :
        Result.Success.Suite({ suite, children });
}

Result.Duration = Duration;
Result.Failure.Reason = Reason;

module.exports = Result;
