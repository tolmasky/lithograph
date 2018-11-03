const { log2, ceil, floor } = Math;

exports.End = 1;

exports.push = function push(keyPath, size, index)
{
    if (size === 1)
        return keyPath;

    const remaining = 32 - (floor(log2(keyPath)) + 1);
    const shift = ceil(log2(size));

    if (shift > remaining)
        throw Error("Out of space");

    return ((keyPath << shift) >>> 0) + index;
}

exports.pop = function pop(keyPath, size)
{
    if (size === 1)
        return [0, keyPath];

    const shift = ceil(log2(size));
    
    return [keyPath & (2 ** shift - 1), keyPath >> shift];
}

//const keyPath = push(push(push(0, 10, 12), 1, 2), 0, 100).toString(2);

//0,1 -> 1
//2,3 -> 2

//ceil(log2(4+1))
/*

x = 1;
for (i=0;i<31;++i)
    x = push(x, 1, 2);

for(i=0;i<31;++i)
{
    [x, index] = pop(x, 1, 2);
    console.log(index);
}
//x.toString(2)
//push(push(1, 10, 12), 2, 3).toString(2)
//(10 << 1).toString(2)
*/