
Run.State.RUNNING   = 0;
Run.State.WAITING   = 1;
Run.State.FAILURE   = 2;
Run.State.SUCCESS   = 3;
Run.State.EMPTY     = 4;
Run.State.DISABLED  = 5;

const Running = Record({ status: 0, start: -1 });
const Waiting = Record({ status: 1 });
const Failure = Record({ status: 2, duration: -1 });
const Success = Record({ status: 3, duration: -1 });
const Skipped = Record({ status: 4 });


Run.State = Record({ aggregate:1, individual:1, metaDataPath:"", value:-1, start:-1, duration:-1 });

Run.State.RUNNING   = 0;
Run.State.WAITING   = 1;
Run.State.FAILURE   = 2;
Run.State.SUCCESS   = 3;
Run.State.EMPTY     = 4;
Run.State.DISABLED  = 5;





function process({ node }, states)
{
    if (node instanceof Suite)
    {

    }
    else if (node instanceof Test)
    {
        do_(test.blocks).then().catch();
    }
}

function feed(path, states)
{
    const { parent, index } = path;
    const suite = parent.node;
    const isSerial = suite.schedule === Suite.Serial;
    const siblings = suite.children;
    const siblingsComplete = isSerial ? 
        index === children.length - 1 :
        siblings.every(sibling => states.has(sibling));

    if (siblingsComplete)
        return parent;

    return isSerial ? postOrderLeaves(parent, index + 1) : [];
}

function postOrderLeaves(parent, index)
{
    const siblings = parent.node.children;
    const node = siblings[index];

    return node instanceof Test ?
        Path({ node, parent, index }) :
        node.schedule === Suite.Serial ?
            postOrderLeaves(node, 0) :
            node.children.flatMap((_, index) =>
                postOrderLeaves(node, index));
}

async function process({ node }, states)
{
    return node instanceof Suite ? 
        process.suite(node, states) :
        await process.test(node);
}

process.test = async function (test)
{
    const duration = (start => () => 
        (Date.now() - start))(Date.now());

    try
    {
        for (const block of test.blocks)
            eval(block);
    }
    catch (reason)
    {
        return Failure({ duration: duration(), reason });
    }

    return Success({ duration: duration() });
}

process.suite = function (suite, states)
{
    const children = suite.children
        .map(child => states.get(child));
    const failures = children
        .filter(state => state instanceof Failure)
    const duration = children.reduce(
        (duration, state) => duration + state.duration, 0);

    return failures.size > 0 ?
        Failure({ duration, reason: failures }) :
        Success({ duration });
}

