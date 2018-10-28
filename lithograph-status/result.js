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

/*const { data, string, number } = require("@cause/type/type2.js");
const List = () => ({ is: () => true });
const Node = () => ({ is: () => true });

const Skipped = data `Skipped`
    `Test` (origin => number, node => Node)
    `Suite` (origin => number, node => Node, children => List(Skipped));

const Omitted = data `Omitted`
    `Test` (origin => number, node => Node)
    `Suite` (origin => number, children => List(Omitted));

const Success = data `Success`
    `Test` (origin => duration)
    `Suite` (children => List(Passed));

const Reason = data `Reason`
    `Exception` (stack => string, message => string)
    `Value` (stringified => string);

const Failure = data `Failure`
    `Test` (duration => number, reason => Reason)
    `Suite` (duration => number, children => List(AnyResult));

const PassedResult = data `PassedResult`
    `Skipped` (() => Skipped)
    `Success` (() => Success);

const AnyResult = data `AnyResult`
    `Skipped` (() => Skipped)
    `Success` (() => Success)
    `Omitted` (() => Omitted)
    `Failure` (() => Failure);

const FileResult = data `FileResult`
    `Skipped` (() => Skipped)
    `Success` (() => Success)
    `Failure` (() => Failure);


module.exports =
    { PassedResult, AnyResult, FileResult, Skipped, Omitted, Success, Failure };
/*

const StatusNode = type.of(Child =>
    type.StatusNode
        .Test(test => Node)
        .Suite(suite => Suite, children => List(Child));

const Skipped = StatusNode(() => Skipped);
const Omitted = StatusNode(() => Omitted);
const Success = StatusNode(() => Either(Skipped, Success));
const Failure = StatusNode(() => Status);

const Maybe = type.of(T =>
    type.Maybe
        .Just (() => T)
        .Nothing);
        
*/