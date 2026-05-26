import LoadOut from "../models/transaction/LoadOut.js";
import LoadIn from "../models/transaction/loadIn.js";
import Rate from "../models/rates.js";
import { Item } from "../models/SKU.js";
import MtPrice from "../models/mtPrice.js";
import { normalizeCasesBottles, seperateCrate_Bottle } from "../utils/normalizeQty.js";

export const salesmanwiseItemwiseSummary = async (req, res) => {
  const normalize = v => typeof v === "string" ? v.trim().toLowerCase() : "";
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

    const [loadOutDocs, loadInDocs, rates, mtRates, it] = await Promise.all([
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

        const item = it.find((i) => String(i.code) === String(items.itemCode));
        if (!item) continue;

        // Convert qty from string to number
        const qty = parseFloat(items.qty) || 0;
        const { cases, bottles } = seperateCrate_Bottle(qty, (item?.packOf || 24));
        console.log(items.itemCode, "cases", cases, "bottles", bottles);

        if (item.container.toLowerCase() === "mt" || item.container.toLowerCase() == "emt") {
          const latestMtPrice = getMtRate(doc.date, items.itemCode);
          console.log("raTE", items.itemCode, latestMtPrice);
          if (!latestMtPrice) continue;

          const basePrice = parseFloat(((latestMtPrice.cratePrice || 0) + (latestMtPrice.emptyBottlePrice || 0) * (item.packOf || 24) + (latestMtPrice.drinkPrice || 0)).toFixed(2));
          const disc = latestMtPrice.drinkPrice * (latestMtPrice?.perDisc || 0) / 100;
          const tax = (latestMtPrice.drinkPrice - disc) * (latestMtPrice?.perTax || 0) / 100;
          const finalPrice = parseFloat((basePrice + tax - disc).toFixed(2));

          const pricePerBottle = Number(parseFloat(finalPrice / (item?.packOf || 24)).toFixed(2));

          if (!summaryMap.has(items.itemCode)) {
            summaryMap.set(items.itemCode, {
              itemCode: items.itemCode,
              itemName: item?.name || "",
              cases: 0,
              bottles: 0,
              amount: 0
            })
          };

          const caseAmt = cases * finalPrice;
          const bottleAmt = pricePerBottle * bottles;

          const amt = caseAmt + bottleAmt;
          console.log("amt", amt);

          let agg = summaryMap.get(items.itemCode);
          agg.cases += cases;
          agg.bottles += bottles;
          agg.amount += amt;

        } else {
          const latestRate = getRate(doc.date, items.itemCode);
          console.log("raTE", items.itemCode, latestRate);
          if (!latestRate) continue;

          const basePrice = parseFloat((latestRate?.basePrice || 0).toFixed(2));
          const disc = basePrice * (latestRate?.perDisc || 0) / 100;
          const tax = (basePrice - disc) * (latestRate?.perTax || 0) / 100;
          const finalPrice = parseFloat((basePrice + tax - disc).toFixed(2));

          const pricePerBottle = Number(parseFloat(finalPrice / (item?.packOf || 24)).toFixed(2));

          if (!summaryMap.has(items.itemCode)) {
            summaryMap.set(items.itemCode, {
              itemCode: items.itemCode,
              itemName: item?.name || "",
              cases: 0,
              bottles: 0,
              amount: 0
            })
          };

          const caseAmt = cases * finalPrice;
          const bottleAmt = pricePerBottle * bottles;

          const amt = caseAmt + bottleAmt;
          console.log("amt", amt);

          let agg = summaryMap.get(items.itemCode);
          agg.cases += cases;
          agg.bottles += bottles;
          agg.amount += amt;

        }
      }
    }

    for (const doc of loadInDocs) {
      for (const items of doc.items) {
        const emtVal = items?.Emt || 0;
        console.log("loadin");
        if (emtVal == 0) {
          const item = it.find((i) => String(i.code) === String(items.itemCode));
          console.log(item);
          if (!item) continue;

          // Calculate qty from Filled + Burst (convert from strings to numbers)
          const filled = parseFloat(items.Filled) || 0;
          const burst = parseFloat(items.Burst) || 0;
          const qty = filled + burst;

          const { cases, bottles } = seperateCrate_Bottle(qty, (item?.packOf || 24));
          console.log(items.itemCode, "cases", cases, "bottles", bottles);

          const latestRate = getRate(doc.date, items.itemCode);
          console.log("raTE", items.itemCode, latestRate);
          if (!latestRate) continue;

          const basePrice = parseFloat((latestRate?.basePrice || 0).toFixed(2));
          const disc = basePrice * (latestRate?.perDisc || 0) / 100;
          const tax = (basePrice - disc) * (latestRate?.perTax || 0) / 100;
          const finalPrice = parseFloat((basePrice + tax - disc).toFixed(2));

          const pricePerBottle = Number(parseFloat(finalPrice / (item?.packOf || 24)).toFixed(2));

          if (!summaryMap.has(items.itemCode)) {
            summaryMap.set(items.itemCode, {
              itemCode: items.itemCode,
              itemName: item?.name || "",
              cases: 0,
              bottles: 0,
              amount: 0
            })
          };

          const caseAmt = cases * finalPrice;
          const bottleAmt = pricePerBottle * bottles;

          const amt = caseAmt + bottleAmt;
          console.log("amt", amt);

          let agg = summaryMap.get(items.itemCode);
          agg.cases -= cases;
          agg.bottles -= bottles;
          agg.amount -= amt;
        }
      }
    }

    const summary = [];
    let grandTotalCases = 0;
    let grandTotalBottles = 0;
    let grandTotalAmount = 0;

    for (const [itemCode, data] of summaryMap) {
      console.log(itemCode, data);
      summary.push({
        itemCode,
        name: data.itemName,
        cases: data.cases,
        bottles: data.bottles,
        amount: Number(parseFloat(data.amount).toFixed(2))
      });

      grandTotalCases += data.cases;
      grandTotalBottles += data.bottles;
      grandTotalAmount += Number(data.amount || 0);
    }

    summary.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

    res.status(200).json({
      success: true,
      data: summary,
      grandTotal: {
        grandTotalCases,
        grandTotalBottles,
        amount: parseFloat(grandTotalAmount.toFixed(2))
      }
    });

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