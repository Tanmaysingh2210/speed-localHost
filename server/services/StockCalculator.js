// import mongoose from 'mongoose';
// import Loadout from '../models/transaction/LoadOut.js';
// import PurchaseItemwise from '../models/purchase/PurchaseItemwise.js';

// class StockService {
//     static async cleanupExpiredItems(depoId) {
//         const now = new Date();

//         const purchases = await PurchaseItemwise.find({ depo: depoId, isFullyProcessed: false });

//         let totalExpiredQty = 0;
//         const expiredLog = [];

//         for (const purchase of purchases) {
//             let hasChanges = false;

//             purchase.items = purchase.items.filter(item => {
//                 if (item.expiryDate <= now && item.remainingQty > 0) {
//                     expiredLog.push({
//                         itemCode: item.itemCode,
//                         qty: item.remainingQty,
//                         expiryDate: item.expiryDate,
//                         purchaseDate: purchase.date,
//                         depo: depoId
//                     });
//                     totalExpiredQty += item.remainingQty;
//                     hasChanges = true;
//                     return false; //remove expired item from array
//                 }
//                 return true;
//             });

//             const allExhausted = purchase.items.length === 0 || purchase.items.every(item => item.remainingQty <= 0);

//             if (allExhausted) {
//                 purchase.isFullyProcessed = true;
//                 hasChanges = true;
//             }

//             if (hasChanges) await purchase.save();
//         }
//         return { totalExpiredQty, expiredLog };
//     }

//     static async processLoadout(loadoutItems, depoId) {
//         const results = [];
//         const now = new Date();

//         for (const loadoutItem of loadoutItems) {
//             let remainingToLoad = loadoutItem.qty;
//             const allocations = [];

//             const purchases = await PurchaseItemwise.find({
//                 depo: depoId,
//                 isFullyProcessed: false,
//                 'items.itemCode': loadoutItem.itemCode,
//                 'items.remainingQty': { $gt: 0 },
//                 'items.expiryDate': { $gt: now }
//             }).sort({ 'items.expiryDate': 1 });

//             for (const purchase of purchases) {
//                 if (remainingToLoad <= 0) break;

//                 for (const item of purchase.items) {
//                     if (item.itemCode === loadoutItem.itemCode &&
//                         item.remainingQty > 0 &&
//                         item.expiryDate > now
//                     ) {
//                         const qtyToDeduct = Math.min(item.remainingQty, remainingToLoad);
//                         item.remainingQty -= qtyToDeduct;
//                         remainingToLoad -= qtyToDeduct;

//                         allocations.push({
//                             purchaseId: purchase._id,
//                             purchaseDate: purchase.date,
//                             expiryDate: item.expiryDate,
//                             qty: qtyToDeduct
//                         });

//                         if (purchase.items.every(i => i.remainingQty <= 0)) { //allexhaousted
//                             purchase.isFullyProcessed = true;
//                         }

//                         await purchase.save();

//                         if (remainingToLoad <= 0) break;
//                     }
//                 }
//             }

//             results.push({
//                 itemCode: loadoutItem.itemCode,
//                 requestedQty: loadoutItem.qty,
//                 allocatedQty: loadoutItem.qty - remainingToLoad,
//                 shortfall: remainingToLoad,
//                 allocations
//             });
//         }
//         return results;
//     }


//     //get current stock summary
//     static async getCurrentStock(depoId) {
//         const now = new Date();

//         const purchases = await PurchaseItemwise.find({
//             depo: depoId,
//             isFullyProcessed: false
//         });

//         const stockMap = new Map();

//         for (const purchase of purchases) {
//             for (const item of purchase.items) {
//                 if (item.remainingQty <= 0 || item.expiryDate <= now) {
//                     continue;
//                 }

//                 if (!stockMap.has(item.itemCode)) {
//                     stockMap.set(item.itemCode, {
//                         itemCode: item.itemCode,
//                         totalQty: 0,
//                         batches: []
//                     });
//                 }

//                 const stock = stockMap.get(item.itemCode);
//                 stock.totalQty += item.remainingQty;
//                 stock.batches.push({
//                     purchaseId: purchase._id,
//                     purchaseDate: purchase.date,
//                     qty: item.remainingQty,
//                     expiryDate: item.expiryDate,
//                     daysUntilExpiry: Math.ceil((item.expiryDate - now) / (1000 * 60 * 60 * 24))
//                 });
//             }
//         }

//         // Sort batches by expiry date for each item
//         stockMap.forEach(stock => {
//             stock.batches.sort((a, b) => a.expiryDate - b.expiryDate);
//         });

//         return Array.from(stockMap.values()).sort((a, b) =>
//             a.itemCode.localeCompare(b.itemCode)
//         );
//     }


//     static async getStockByItemCode(depoId, itemCode) {
//         const stock = await this.getCurrentStock(depoId);
//         return stock.find(s => s.itemCode === itemCode);
//     }


//     static async getExpiringItems(depoId, daysThreshold = 30) {
//         const now = new Date();
//         const thresholdDate = new Date(now.getTime() + (daysThreshold * 24 * 60 * 60 * 1000));

//         const purchases = await PurchaseItemwise.find({
//             depo: depoId,
//             isFullyProcessed: false,
//             'items.expiryDate': { $gt: now, $lte: thresholdDate },
//             'items.remainingQty': { $gt: 0 }
//         });

//         const expiringItems = [];

//         for (const purchase of purchases) {
//             for (const item of purchase.items) {
//                 if (item.remainingQty > 0 &&
//                     item.expiryDate > now &&
//                     item.expiryDate <= thresholdDate
//                 ) {
//                     expiringItems.push({
//                         itemCode: item.itemCode,
//                         qty: item.remainingQty,
//                         expiryDate: item.expiryDate,
//                         purchaseDate: purchase.date,
//                         daysUntilExpiry: Math.ceil((item.expiryDate - now) / (1000 * 60 * 60 * 24))
//                     });
//                 }
//             }
//         }
//         return expiringItems.sort((a, b) => a.expiryDate - b.expiryDate);
//     }
// }


// export default StockService;

















import PurchaseItemwise from '../models/purchase/PurchaseItemwise.js';
import { Item } from '../models/SKU.js';

// ─────────────────────────────────────────────
// Conversion Utilities
// ─────────────────────────────────────────────

/**
 * cases.bottles decimal → total bottles (integer) for arithmetic
 * Works for both old integer cases (278) and new decimal (2.09)
 * 278    packOf=24 → (278×24)+0  = 6672 bottles  ✅ old data
 * 2.09   packOf=24 → (2×24)+9   =   57 bottles   ✅ new data
 * 0.05   packOf=12 → (0×12)+5   =    5 bottles   ✅ bottles only
 */
export function casesToBottles(qty, packOf) {
    if (!packOf || packOf <= 0) return Math.round(qty);
    const cases = Math.floor(qty);
    const bottles = Math.round((qty - cases) * 100);
    return (cases * packOf) + bottles;
}

/**
 * total bottles (integer) → cases.bottles decimal for storage/display
 * 6672 bottles packOf=24 → 278.00
 *   57 bottles packOf=24 →   2.09
 *    5 bottles packOf=12 →   0.05
 */
export function bottlesToCases(totalBottles, packOf) {
    if (!packOf || packOf <= 0) return totalBottles;
    const cases = Math.floor(totalBottles / packOf);
    const rem = totalBottles % packOf;
    return parseFloat(`${cases}.${String(rem).padStart(2, '0')}`);
}

// ─────────────────────────────────────────────
// Internal: fetch packOf map for itemCodes in a depo
// ─────────────────────────────────────────────
async function getPackOfMap(itemCodes, depoId) {
    const skus = await Item.find({
        code: { $in: itemCodes.map(c => c.toUpperCase()) },
        depo: depoId
    }).select('code packOf');

    const map = {};
    for (const sku of skus) {
        map[sku.code.toUpperCase()] = sku.packOf;
    }
    return map;
}

class StockService {

    // ─────────────────────────────────────────────
    // Cleanup expired items
    // DB: remainingQty in cases.bottles decimal
    // No arithmetic needed — just filter and zero out
    // ─────────────────────────────────────────────
    static async cleanupExpiredItems(depoId) {
        const now = new Date();
        const purchases = await PurchaseItemwise.find({ depo: depoId, isFullyProcessed: false });

        let totalExpiredQty = 0; // in cases.bottles (sum for logging only)
        const expiredLog = [];

        for (const purchase of purchases) {
            let hasChanges = false;

            purchase.items = purchase.items.filter(item => {
                if (item.expiryDate <= now && item.remainingQty > 0) {
                    expiredLog.push({
                        itemCode: item.itemCode,
                        qty: item.remainingQty,        // cases.bottles as stored
                        expiryDate: item.expiryDate,
                        purchaseDate: purchase.date,
                        depo: depoId
                    });
                    totalExpiredQty += item.remainingQty;
                    hasChanges = true;
                    return false;
                }
                return true;
            });

            const allExhausted =
                purchase.items.length === 0 ||
                purchase.items.every(i => i.remainingQty <= 0);

            if (allExhausted) {
                purchase.isFullyProcessed = true;
                hasChanges = true;
            }

            if (hasChanges) await purchase.save();
        }

        return { totalExpiredQty, expiredLog };
    }

    // ─────────────────────────────────────────────
    // Process loadout — FIFO stock deduction
    //
    // DB:    remainingQty in cases.bottles (e.g. 278.00 or 2.09)
    // Input: loadoutItem.qty in cases.bottles (e.g. 3.06)
    //
    // Strategy:
    //   1. Convert BOTH remainingQty and requested qty to bottles
    //   2. Do arithmetic in bottles (clean integers)
    //   3. Save result back as cases.bottles decimal
    // ─────────────────────────────────────────────
    static async processLoadout(loadoutItems, depoId) {
        const results = [];
        const now = new Date();

        const itemCodes = loadoutItems.map(i => i.itemCode.toUpperCase());
        const packOfMap = await getPackOfMap(itemCodes, depoId);

        for (const loadoutItem of loadoutItems) {
            const code = loadoutItem.itemCode.toUpperCase();
            const packOf = packOfMap[code];

            if (!packOf) {
                results.push({
                    itemCode: code,
                    requestedQty: loadoutItem.qty,
                    allocatedQty: 0,
                    shortfall: loadoutItem.qty,
                    allocations: [],
                    error: 'Item not found or packOf missing'
                });
                continue;
            }

            // Step 1: convert requested qty to bottles
            const requestedBottles = casesToBottles(loadoutItem.qty, packOf);
            let remainingToLoad = requestedBottles; // working in bottles
            const allocations = [];

            const purchases = await PurchaseItemwise.find({
                depo: depoId,
                isFullyProcessed: false,
                'items.itemCode': code,
                'items.remainingQty': { $gt: 0 },
                'items.expiryDate': { $gt: now }
            }).sort({ 'items.expiryDate': 1 }); // FIFO by nearest expiry

            for (const purchase of purchases) {
                if (remainingToLoad <= 0) break;

                for (const item of purchase.items) {
                    if (
                        item.itemCode.toUpperCase() === code &&
                        item.remainingQty > 0 &&
                        item.expiryDate > now
                    ) {
                        // Step 2: convert DB remainingQty (cases.bottles) → bottles
                        const availableBottles = casesToBottles(item.remainingQty, packOf);

                        // Step 3: arithmetic in bottles
                        const bottlesToDeduct = Math.min(availableBottles, remainingToLoad);
                        const bottlesLeft = availableBottles - bottlesToDeduct;
                        remainingToLoad -= bottlesToDeduct;

                        // Step 4: save back as cases.bottles decimal
                        item.remainingQty = bottlesToCases(bottlesLeft, packOf);

                        allocations.push({
                            purchaseId: purchase._id,
                            purchaseDate: purchase.date,
                            expiryDate: item.expiryDate,
                            qty: bottlesToCases(bottlesToDeduct, packOf), // display format
                            qtyBottles: bottlesToDeduct                   // raw for reference
                        });

                        if (purchase.items.every(i => i.remainingQty <= 0)) {
                            purchase.isFullyProcessed = true;
                        }

                        await purchase.save();
                        if (remainingToLoad <= 0) break;
                    }
                }
            }

            const allocatedBottles = requestedBottles - remainingToLoad;

            results.push({
                itemCode: code,
                requestedQty: loadoutItem.qty,                         // original input (cases.bottles)
                allocatedQty: bottlesToCases(allocatedBottles, packOf), // display (cases.bottles)
                shortfall: remainingToLoad,                             // in bottles (0 = fully allocated)
                shortfallCases: bottlesToCases(remainingToLoad, packOf),
                allocations
            });
        }

        return results;
    }

    // ─────────────────────────────────────────────
    // Get current stock summary
    //
    // DB: remainingQty in cases.bottles
    // Convert to bottles for summing (critical — can't add decimals directly)
    // Return both bottles (totalQty) and cases.bottles (totalCases) for frontend
    // ─────────────────────────────────────────────
    static async getCurrentStock(depoId) {
        const now = new Date();

        const purchases = await PurchaseItemwise.find({
            depo: depoId,
            isFullyProcessed: false
        });

        const allCodes = new Set();
        for (const purchase of purchases) {
            for (const item of purchase.items) {
                allCodes.add(item.itemCode.toUpperCase());
            }
        }

        const packOfMap = await getPackOfMap([...allCodes], depoId);
        const stockMap = new Map();

        for (const purchase of purchases) {
            for (const item of purchase.items) {
                if (item.remainingQty <= 0 || item.expiryDate <= now) continue;

                const code = item.itemCode.toUpperCase();
                const packOf = packOfMap[code];

                if (!stockMap.has(code)) {
                    stockMap.set(code, {
                        itemCode: code,
                        packOf: packOf || null,
                        totalBottles: 0,  // accumulate in bottles (safe integer math)
                        batches: []
                    });
                }

                const stock = stockMap.get(code);

                // Convert cases.bottles → bottles before summing
                // e.g. 278.00 + 2.09 as decimals = 280.09 (WRONG)
                // e.g. 6672   + 57   as integers  = 6729   (CORRECT)
                const batchBottles = packOf
                    ? casesToBottles(item.remainingQty, packOf)
                    : item.remainingQty;

                stock.totalBottles += batchBottles;

                stock.batches.push({
                    purchaseId: purchase._id,
                    purchaseDate: purchase.date,
                    qty: item.remainingQty,   // as stored (cases.bottles) for reference
                    qtyBottles: batchBottles, // converted for display
                    expiryDate: item.expiryDate,
                    daysUntilExpiry: Math.ceil((item.expiryDate - now) / (1000 * 60 * 60 * 24))
                });
            }
        }

        stockMap.forEach(stock => {
            stock.batches.sort((a, b) => a.expiryDate - b.expiryDate);
            // Expose totalQty in bottles for frontend bottlesToDisplay()
            stock.totalQty = stock.totalBottles;
            stock.totalCases = stock.packOf
                ? bottlesToCases(stock.totalBottles, stock.packOf)
                : null;
            delete stock.totalBottles; // clean up internal field
        });

        return Array.from(stockMap.values()).sort((a, b) =>
            a.itemCode.localeCompare(b.itemCode)
        );
    }

    static async getStockByItemCode(depoId, itemCode) {
        const stock = await this.getCurrentStock(depoId);
        return stock.find(s => s.itemCode === itemCode.toUpperCase()) || null;
    }

    // ─────────────────────────────────────────────
    // Get expiring items
    // ─────────────────────────────────────────────
    static async getExpiringItems(depoId, daysThreshold = 30) {
        const now = new Date();
        const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

        const purchases = await PurchaseItemwise.find({
            depo: depoId,
            isFullyProcessed: false,
            'items.expiryDate': { $gt: now, $lte: thresholdDate },
            'items.remainingQty': { $gt: 0 }
        });

        const allCodes = new Set();
        for (const p of purchases) {
            for (const item of p.items) allCodes.add(item.itemCode.toUpperCase());
        }
        const packOfMap = await getPackOfMap([...allCodes], depoId);

        const expiringItems = [];

        for (const purchase of purchases) {
            for (const item of purchase.items) {
                if (
                    item.remainingQty > 0 &&
                    item.expiryDate > now &&
                    item.expiryDate <= thresholdDate
                ) {
                    const code = item.itemCode.toUpperCase();
                    const packOf = packOfMap[code];
                    const qtyBottles = packOf
                        ? casesToBottles(item.remainingQty, packOf)
                        : item.remainingQty;

                    expiringItems.push({
                        itemCode: code,
                        packOf: packOf || null,
                        qty: item.remainingQty,  // as stored (cases.bottles)
                        qtyBottles,              // converted for display
                        expiryDate: item.expiryDate,
                        purchaseDate: purchase.date,
                        daysUntilExpiry: Math.ceil((item.expiryDate - now) / (1000 * 60 * 60 * 24))
                    });
                }
            }
        }

        return expiringItems.sort((a, b) => a.expiryDate - b.expiryDate);
    }
}

export default StockService;