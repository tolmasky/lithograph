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

const Duration = union `Duration` (
    data `Interval` (
        start => number,
        end => number ),
    data  `Instant` () );


const Result = union `Result` (
    result `Skipped` (
        [origin => number],
        [origin => number, children => List(Skipped)]),

    result `Omitted` (
        [origin => number],
        [origin => number, children => List(Omitted)]),

    result `Success` (
        [duration => [Duration, Duration.Instant]],
        [children => [List(Passed), List(Passed)()]]),

    result `Failure` (
        [duration => number, reason => Reason],
        [duration => number, children => List(Result) ]) );
const Passed = union `Passed` (Result.Success, Result.Skipped);

Result.Suite = union `Suite` (
    Skipped => Result.Skipped.Suite,
    Omitted => Result.Omitted.Suite,
    Success => Result.Success.Suite,
    Failure => Result.Failure.Suite );

Result.Duration = Duration;
Result.Failure.Reason = Reason;

module.exports = Result;
