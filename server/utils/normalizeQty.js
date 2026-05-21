// export function normalizeQty(qty, packOf) {
//     const cases = Math.floor(qty);
//     const bottles = Math.round((qty - cases) * 100); // "09" part of 2.09
//     const extraCases = Math.floor(bottles / packOf);
//     const remainingBottles = bottles % packOf;
//     return parseFloat(`${cases + extraCases}.${String(remainingBottles).padStart(2, '0')}`).toFixed(2);
// }

export function normalizeQty(qty, packOf) {
    const cases = Math.floor(qty);
    const bottles = Math.round((qty - cases) * 100);
    const extraCases = Math.floor(bottles / packOf);
    const remainingBottles = bottles % packOf;
    // Return plain number — toFixed(2) only for display, not here
    return `${cases + extraCases}.${String(remainingBottles).padStart(2, '0')}`;
}