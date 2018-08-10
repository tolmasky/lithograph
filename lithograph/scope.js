module.exports = function scope(parent)
{
    if (parent)
        return parent("(" + scope + ")()");

    return (function (iterator)
    {
        const scope = Object.create(null);
        const originalEval = eval;

        iterator.next();

        return function (source)
        {
            const currentEval = iterator.next(scope).value;

            iterator.next(originalEval);

            const result = iterator.next(source).value

            iterator.next(originalEval);
            iterator.next(currentEval);
            iterator.next();
    
            return result;
        }
    })
    (function *()
    {
        with (yield)
        {
            while (true)
            {
                // 1. Reset eval.
                // We need local eval.
                eval = yield eval /*eval*/;
                // 2. Eval our source code.
                // We'll get the function back below.
                yield eval(yield /*source*/);
                // 3. Set eval back if necessary.
                // This covers the case where someone does var eval
                // (in which case eval will now be undefined), or
                // if someone does function eval(), in which case
                // it'll also have a different value.
                eval === (yield) ? eval = yield : yield;
                // 5. Wait
                yield;
            }
        }
    }());
}
/*
const runInScope = scope();


runInScope("var x = 10; console.log('ok', x)");
//console.log(x);
runInScope("console.log(x)");
runInScope("console.log(10)");
runInScope("console.log(11)");
runInScope("console.log(12)");
const runInScope2 = runInScope("(" + scope + ")()");
console.log(runInScope2);
runInScope2("var y = 12");
runInScope2("console.log(x, y)");
runInScope("console.log(x, y)");

/*
function ()
{
    const scope = Object.create(null);
    
    
}

function _(originalEval, scope, blocks)
{
    for (const block of blocks)
    {
        const currentEval = scope.next().value;

        scope.next(originalEval);

        const result = scope.next(block).value;

        scope.next(originalEval);
        scope.next(currentEval);
    }
}*/