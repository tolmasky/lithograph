const { is, data, union, string, number, declare } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Node = require("@lithograph/ast");
const FIXME_ANY = declare({ is: () => true, serialize:[()=>0,true],deserialize:()=>undefined });


const result = ([name]) => 
    (testFields, suiteFields) => union([name]) (
        data `Test` (
            ...testFields,
            fromKeyPath => [FIXME_ANY, null],
            test => Node.Test ),
        data `Suite` (
            ...suiteFields,
            fromKeyPath => [FIXME_ANY, null],
            suite => Node.Suite) );

const Reason = union `Reason` (
    data `Error` (
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

Result.Success.Suite.prototype.update = function (key, f)
{
    return Result.Success.Suite({ ...this, [key]: f(this[key]) });
}

Result.Failure.Suite.prototype.update = function (key, f)
{
    return Result.Failure.Suite({ ...this, [key]: f(this[key]) });
}

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
