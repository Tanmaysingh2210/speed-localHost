
export function normalizeQty(qty, packOf) {
    const cases = Math.floor(qty);
    const bottles = Math.round((qty - cases) * 100);
    const extraCases = Math.floor(bottles / packOf);
    const remainingBottles = bottles % packOf;
    return `${cases + extraCases}.${String(remainingBottles).padStart(2, '0')}`;
}

export function seperateCrate_Bottle(qty, packOf) {
    const cases = Math.floor(qty);
    const bottles = Math.round((qty - cases) * 100);
    const extraCases = Math.floor(bottles / packOf);
    const remainingBottles = bottles % packOf;
    return { cases: cases + extraCases, bottles:remainingBottles };
}

// Normalize cases/bottles after subtraction — borrow from cases when bottles go negative
export function normalizeCasesBottles(cases, bottles, packOf) {
    if (!packOf || packOf <= 0) return { cases, bottles };
    while (bottles < 0) {
        cases -= 1;
        bottles += packOf;
    }
    while (bottles >= packOf) {
        cases += 1;
        bottles -= packOf;
    }
    return { cases, bottles };
}