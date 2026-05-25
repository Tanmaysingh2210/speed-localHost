// import express from "express";
// import LoadOut from "../models/transaction/LoadOut.js";

// // console.log("✅ SalesmanWiseItemWise Summary Loaded");
// export const salesmanwiseItemwiseSummary = async (req, res) => {
//   try {
//     // console.log("→ SalesmanWiseItemwise called", {
//     //   salesmanCode: req.query.salesmanCode,
//     //   start: req.query.startDate,
//     //   end: req.query.endDate,
//     //   user: req.user ? req.user._id : "NO USER",
//     //   depo: req.user?.depo || "NO DEPO"
//     // });

//     const { salesmanCode, startDate, endDate } = req.query;

//     if (!salesmanCode || !startDate || !endDate) {
//       return res.status(400).json({ message: "Missing required parameters" });
//     }

//     if (!req.user?.depo) {
//       console.log("CRITICAL: No depo in req.user");
//       return res.status(401).json({ message: "User depo not found - authentication issue" });
//     }

//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);
//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     const result = await LoadOut.aggregate([
//       // Step 1: LoadOut ke saare relevant records
//       {
//         $match: {
//           salesmanCode,
//           depo: req.user.depo,
//           date: { $gte: start, $lte: end }
//         }
//       },
//       { $unwind: "$items" },
//       // Filter out EMT (empty) items
//       {
//         $match: {
//           "items.itemCode": { $not: /EMT/ }
//         }
//       },
//       {
//         $project: {
//           _id: 0,                       // exclude _id if you don't want it
//           date: 1,
//           "itemCode": "$items.itemCode",
//           "loadOutQty": "$items.qty",
//           "loadInQty": { $literal: 0 }, // or just 0
//           "source": { $literal: "loadout" }
//         }
//       },

//       // Step 2: Union with LoadIn (Emt ignore → sirf Filled + Burst)
//       {
//         $unionWith: {
//           coll: "transaction_loadins",
//           pipeline: [
//             {
//               $match: {
//                 salesmanCode,
//                 depo: req.user.depo,
//                 date: { $gte: start, $lte: end }
//               }
//             },
//             { $unwind: "$items" },
//             // Filter out EMT (empty) items
//             {
//               $match: {
//                 "items.itemCode": { $not: /EMT/ }
//               }
//             },
//             {
//               $project: {
//                 _id: 0,
//                 date: 1,
//                 "itemCode": "$items.itemCode",
//                 "loadOutQty": { $literal: 0 },
//                 "loadInQty": {
//                   $add: [
//                     { $ifNull: ["$items.Filled", 0] },
//                     { $ifNull: ["$items.Burst", 0] }
//                   ]
//                 },
//                 "source": { $literal: "loadin" }
//               }
//             },
//           ]
//         }
//       },

//       // Step 3: date + itemCode pe group → net qty per day per item
//       {
//         $group: {
//           _id: { date: "$date", itemCode: "$itemCode" },
//           date: { $first: "$date" },
//           itemCode: { $first: "$itemCode" },
//           loadOutQty: { $sum: "$loadOutQty" },
//           loadInQty: { $sum: "$loadInQty" }
//         }
//       },
//       {
//         $addFields: {
//           netQty: { $subtract: ["$loadOutQty", "$loadInQty"] }
//         }
//       },

//       // Step 4: Is date ke liye latest rate lookup (depo bhi match karo!)
//       {
//         $lookup: {
//           from: "rates",
//           let: {
//             itemCode: "$itemCode",
//             saleDate: "$date",
//             depo: req.user.depo
//           },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: [{ $toUpper: "$itemCode" }, { $toUpper: "$$itemCode" }] },
//                     { $eq: ["$depo", "$$depo"] },
//                     { $lte: ["$date", "$$saleDate"] }
//                   ]
//                 }
//               }
//             },
//             { $sort: { date: -1 } },
//             { $limit: 1 }
//           ],
//           as: "rateDoc"
//         }
//       },
//       { $unwind: { path: "$rateDoc", preserveNullAndEmptyArrays: true } },

//       // Step 5: netRate calculate
//       {
//         $addFields: {
//           safePerDisc: { $ifNull: ["$rateDoc.perDisc", 0] },
//           safePerTax: { $ifNull: ["$rateDoc.perTax", 0] },
//           basePrice: { $ifNull: ["$rateDoc.basePrice", 0] }
//         }
//       },
//       {
//         $addFields: {
//           taxablePrice: {
//             $subtract: [
//               "$basePrice",
//               { $multiply: ["$basePrice", { $divide: ["$safePerDisc", 100] }] }
//             ]
//           }
//         }
//       },
//       {
//         $addFields: {
//           netRate: {
//             $add: [
//               "$taxablePrice",
//               { $multiply: ["$taxablePrice", { $divide: ["$safePerTax", 100] }] }
//             ]
//           }
//         }
//       },
//       {
//         $addFields: {
//           netRate: { $ifNull: ["$netRate", 0] },
//           dailyAmount: { $multiply: ["$netQty", "$netRate"] }
//         }
//       },

//       // Step 6: Final group by itemCode → total qty + total amount

//       {
//         $group: {
//           _id: "$itemCode",
//           itemCode: { $first: "$itemCode" },
//           qtySale: { $sum: "$netQty" },
//           netPrice: { $sum: "$dailyAmount" }
//         }
//       },

//       // Step 7: Item name lookup
//       {
//         $lookup: {
//           from: "sku_items",
//           localField: "_id",
//           foreignField: "code",
//           as: "item"
//         }
//       },
//       { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },

//       // Step 8: Final projection
//       {
//         $project: {
//           _id: 0,
//           itemCode: "$itemCode",
//           itemName: { $ifNull: ["$item.name", "Unknown"] },
//           qtySale: 1,
//           netPrice: { $round: ["$netPrice", 2] }
//         }
//       },

//       // Optional: sort by qty descending or itemCode
//       { $sort: { qtySale: -1 } }
//     ]);
//     console.log("RESULT COUNT:", result.length);
//     res.json(result);
//   } catch (err) {
//     console.error("SALESMAN-WISE-ITEM-WISE ERROR:", {
//       message: err.message,
//       stack: err.stack?.substring(0, 400),
//       name: err.name
//     });
//     res.status(500).json({
//       error: "Internal server error",
//       message: err.message,
//       // only in dev → remove in prod
//       stack: err.stack
//     });
//   }
// };

















import LoadOut from "../models/transaction/LoadOut.js";
import LoadIn from "../models/transaction/loadIn.js";
import Rate from "../models/rates.js";
import { Item } from "../models/SKU.js";
import MtPrice from "../models/mtPrice.js";

export const salesmanwiseItemwiseSummary = async (req, res) => {
  try {
    const { salesmanCode, startDate, endDate } = req.query;

    if (!salesmanCode || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    if (!req.user?.depo) {
      console.log("CRITICAL: No depo in req.user");
      return res.status(401).json({ message: "User depo not found - authentication issue" });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const depo = req.user.depo;
    const matchQuery = { salesmanCode, depo, date: { $gte: start, $lte: end } };

    const [loadOutDocs, loadInDocs, rates, mtRates, items] = await Promise.all([
      LoadOut.find(matchQuery).lean(),
      LoadIn.find(matchQuery).lean(),
      Rate.find({ depo, date: { $lte: end } }).sort({ date: 1 }),
      MtPrice.find({ depo, date: { $lte: end } }).sort({ date: 1 }),
      Item.find({ depo })
    ]);

    const rateMap = new Map();
    for (const r of rates) {
      if (!rateMap.has(normalize(r.itemCode))) {
        rateMap.set(normalize(r.itemCode), []);
      }
      rateMap.get(normalize(r.itemCode)).push(r);
    }

    const getRate = (saleDate, code) => {
      code = normalize(code);
      const list = rateMap.get(code) || [];
      let chosen = null;
      for (const r of list) {
        if (r.date <= saleDate) chosen = r;
        else break;
      }
      return chosen;
    };

    const mtRateMap = new Map();
    for (const m of mtRates) {
      if (!mtRateMap.has(normalize(m.itemCode))) {
        mtRateMap.set(normalize(m.itemCode), []);
      }
      mtRateMap.get(normalize(m.itemCode)).push(m);
    }

    const getMtRate = (saleDate, code) => {
      code = normalize(code);
      const list = mtRateMap.get(code) || [];
      let chosen = null;
      for (const m of list) {
        if (m.date <= saleDate) chosen = m;
        else break;
      }
      return chosen;
    };

    const summaryMap = new Map();
    for (const doc of loadOutDocs) {
      for (const items of doc.items) {
        const item = items.find((i) => String(i.code) === String(items.itemCode));
        if (!item) continue;

        const latestRate = getRate(doc.date, items.itemCode);
        if (!latestRate) continue;

        if (!summaryMap.has(items.itemCode)) {
          summaryMap.set(items.itemCode, {
            itemCode: items.itemCode,
            cases: 0,
            bottles: 0,
            amount: 0
          })
        };

        const basePrice = parseFloat((latestRate?.basePrice || 0).toFixed(2));
        const disc = basePrice * (latestRate?.perDisc || 0) / 100;
        const tax = (basePrice - disc) * (latestRate?.perTax || 0) / 100;
        const finalPrice = parseFloat((basePrice + tax - disc).toFixed(2));

        //yaha tak hogya hai

        const agg = summaryMap.get(items.itemCode);

        combined.push({
          date: doc.date,
          itemCode: items.itemCode,
          loadOutQty: items.qty,
          loadInQty: 0,
          source: "loadout",
        });
      }
    }

    for (const doc of loadInDocs) {
      for (const items of doc.items) {
        combined.push({
          date: doc.date,
          itemCode: items.itemCode,
          loadOutQty: 0,
          loadInQty: (items.Filled || 0) + (items.Burst || 0),
          source: "loadin",
        });
      }
    }

    const dayItemMap = {};

    for (const record of combined) {
      const dateKey = new Date(record.date).toISOString().split("T")[0];
      const key = `${dateKey}|${record.itemCode}`;

      if (!dayItemMap[key]) {
        dayItemMap[key] = {
          date: record.date,
          itemCode: record.itemCode,
          loadOutQty: 0,
          loadInQty: 0,
        };
      }
      dayItemMap[key].loadOutQty += record.loadOutQty;
      dayItemMap[key].loadInQty += record.loadInQty;
    }

    const dailyItems = Object.values(dayItemMap).map((g) => ({
      ...g,
      netQty: g.loadOutQty - g.loadInQty,
    }));

    // ─── Step 4: Rate lookup (fetch once, match in JS per daily item) ─────────
    // Fetch all rates for this depo with date <= end (covers any saleDate in range)
    const uniqueItemCodes = [...new Set(dailyItems.map((d) => d.itemCode))];

    const rateDocs = await Rate.find({
      depo,
      date: { $lte: end },
    }).lean();

    for (const dailyItem of dailyItems) {
      const saleDate = new Date(dailyItem.date);
      const itemCodeUpper = dailyItem.itemCode.toUpperCase();

      // Mirror pipeline: $eq toUpper + $lte saleDate + $sort date desc + $limit 1
      const matchingRates = rateDocs.filter(
        (r) =>
          r.itemCode.toUpperCase() === itemCodeUpper &&
          new Date(r.date) <= saleDate
      );
      matchingRates.sort((a, b) => new Date(b.date) - new Date(a.date));
      const rateDoc = matchingRates[0] || null;

      const safePerDisc = rateDoc?.perDisc ?? 0;
      const safePerTax = rateDoc?.perTax ?? 0;
      const basePrice = rateDoc?.basePrice ?? 0;

      const taxablePrice =
        basePrice - basePrice * (safePerDisc / 100);

      const netRate =
        taxablePrice + taxablePrice * (safePerTax / 100);

      dailyItem.safePerDisc = safePerDisc;
      dailyItem.safePerTax = safePerTax;
      dailyItem.basePrice = basePrice;
      dailyItem.taxablePrice = taxablePrice;
      dailyItem.netRate = netRate || 0;
      dailyItem.dailyAmount = dailyItem.netQty * (dailyItem.netRate || 0);
    }

    // ─── Step 5: Final group by itemCode → total qtySale + netPrice ───────────
    const finalMap = {};

    for (const dailyItem of dailyItems) {
      const { itemCode } = dailyItem;

      if (!finalMap[itemCode]) {
        finalMap[itemCode] = { itemCode, qtySale: 0, netPrice: 0 };
      }
      finalMap[itemCode].qtySale += dailyItem.netQty;
      finalMap[itemCode].netPrice += dailyItem.dailyAmount;
    }

    // ─── Step 6: SKU name lookup + final projection + sort ───────────────────
    const skuDocs = await Item.find({
      code: { $in: uniqueItemCodes },
    }).lean();

    const skuMap = {};
    for (const sku of skuDocs) {
      skuMap[sku.code] = sku;
    }

    let result = Object.values(finalMap).map((f) => ({
      itemCode: f.itemCode,
      itemName: skuMap[f.itemCode]?.name || "Unknown",
      qtySale: f.qtySale,
      netPrice: Math.round(f.netPrice * 100) / 100,
    }));

    result.sort((a, b) => b.qtySale - a.qtySale);

    console.log("RESULT COUNT:", result.length);
    res.json(result);

  } catch (err) {
    console.error("SALESMAN-WISE-ITEM-WISE ERROR:", {
      message: err.message,
      stack: err.stack?.substring(0, 400),
      name: err.name,
    });
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
      stack: err.stack,
    });
  }
};