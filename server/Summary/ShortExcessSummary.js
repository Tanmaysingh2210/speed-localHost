import Salesman from "../models/salesman.js";
import { Item } from "../models/SKU.js";
import LoadOut from "../models/transaction/LoadOut.js";
import LoadIn from "../models/transaction/loadIn.js";
import Rate from "../models/rates.js";
import MtPrice from "../models/mtPrice.js";
import Settlement from "../models/transaction/Settlement";
import { seperateCrate_Bottle } from "../utils/normalizeQty";

export const ShortExcessSummary = async (req, res) => {
  const normalize = v => typeof v === "string" ? v.trim().toLowerCase() : "";
  try {
    const { startDate, endDate } = req.body;
    const depo = req.user?.depo;

    if (!depo) return res.status(400).json({ message: "Not Authenticated" });

    if (!startDate || !endDate) return res.status(400).json({ message: "Enter dates" });

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);


    const [loadouts, loadins, settlements, rates, mtrates, salesmans, items] = await Promise.all([
      LoadOut.find({ depo, date: { $gte: start, $lte: end } }).lean(),
      LoadIn.find({ depo, date: { $gte: start, $lte: end } }).lean(),
      Settlement.find({ depo, date: { $gte: start, $lte: end } }).lean(),
      Rate.find({ depo, date: { $lte: end } }).lean().sort({ date: 1 }),
      MtPrice.find({ depo, date: { $lte: end } }).lean().sort({ date: 1 }),
      Salesman.find().lean(),
      Item.find().lean()
    ]);

    const salesmanMap = new Map();
    for (const s of salesmans) {
      salesmanMap.set(s.codeNo, {
        code: s.codeNo,
        name: s.name,
      })
    };

    const itemMap = new Map();
    for (const i of items) {
      itemMap.set(i.code, {
        itemCode: i.code,
        name: i.name,
        packOf: i.packOf,
        container: i.container,
      })
    };

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
    for (const doc of loadouts) {
      if (!summaryMap.has(doc.salesmanCode)) {
        const man = salesmanMap.get(doc.salesmanCode);
        summaryMap.set(doc.salesmanCode, {
          salesmanCode: doc.salesmanCode,
          name: man.name,
          cases: 0,
          bottles: 0,
          amount: 0,
          deposit: 0,
        })
      };
      const agg = summaryMap.get(doc.salesmanCode);

      for (const entry of doc.items) {
        const item = itemMap.get(entry.itemCode);
        if (!item) continue;
        const { cases, bottles } = seperateCrate_Bottle(entry.qty, item.packOf);
        agg.cases += cases;
        agg.bottles += bottles;

        if (item.container.toLowerCase() == "mt" || item.container.toLowerCase() == "emt") { //for mt
          const price = getMtRate(doc.date, entry.itemCode);
          if (!price) continue;

          const drinkPrice = price.drinkPrice;
          const disc = drinkPrice * (price?.perDisc || 0) / 100;
          const tax = (drinkPrice - disc) * (price?.perTax || 0) / 100;
          const finalPrice = Number(parseFloat((drinkPrice + tax - disc).toFixed(2)));
          const pricePerbottle = Number(parseFloat(finalPrice / (item.packOf || 1)).toFixed(2));

          const amount = Number(parseFloat((finalPrice * cases) + (bottles * pricePerbottle)).toFixed(2));
          agg.amount += amount;
        } else {
          //other than mt
          const price = getRate(doc.date, entry.itemCode);
          if (!price) continue;

          const basePrice = parseFloat((price?.basePrice || 0).toFixed(2));
          const disc = basePrice * (price?.perDisc || 0) / 100;
          const tax = (basePrice - disc) * (price?.perTax || 0) / 100;
          const finalPrice = Number(parseFloat((basePrice + tax - disc).toFixed(2)));

          const pricePerBottle = Number(parseFloat(finalPrice / item?.packOf).toFixed(2));

          const amount = Number(parseFloat((finalPrice * cases) + (bottles * pricePerbottle)).toFixed(2));
          agg.amount += amount;
        }
      }
    }

    for (const doc of loadins) {
      if (!summaryMap.has(doc.salesmanCode)) {
        const man = salesmanMap.get(doc.salesmanCode);
        summaryMap.set(doc.salesmanCode, {
          salesmanCode: doc.salesmanCode,
          name: man.name,
          cases: 0,
          bottles: 0,
          amount: 0,
          deposit: 0,
        })
      };
      const agg = summaryMap.get(doc.salesmanCode);

      for (const entry of doc.items) {
        const item = itemMap.get(entry.itemCode);
        if (!item) continue;


        if (item.container.toLowerCase() != "mt" && item.container.toLowerCase() != "emt") {

          const qty = parseFloat(entry?.Filled || 0.00) + parseFloat(entry?.Burst || 0.00);
          const { cases, bottles } = seperateCrate_Bottle(qty, item.packOf);
          agg.cases -= cases;
          agg.bottles -= bottles;

          const price = getRate(doc.date, entry.itemCode);
          if (!price) continue;

          const basePrice = parseFloat((price?.basePrice || 0).toFixed(2));
          const disc = basePrice * (price?.perDisc || 0) / 100;
          const tax = (basePrice - disc) * (price?.perTax || 0) / 100;
          const finalPrice = Number(parseFloat((basePrice + tax - disc).toFixed(2)));

          const pricePerBottle = Number(parseFloat(finalPrice / item?.packOf).toFixed(2));

          const amount = Number(parseFloat((finalPrice * cases) + (bottles * pricePerbottle)).toFixed(2));
          agg.amount -= amount;
        }
      }
    };

    for (const doc of settlements) {
      if (!summaryMap.has(doc.salesmanCode)) {
        const man = salesmanMap.get(doc.salesmanCode);
        summaryMap.set(doc.salesmanCode, {
          salesmanCode: doc.salesmanCode,
          name: man.name,
          cases: 0,
          bottles: 0,
          amount: 0,
          deposit: 0,
        })
      };

      const agg = summaryMap.get(doc.salesmanCode);

      const totalDeposit = Number(parseFloat((doc?.cashDeposited || 0.00) + (doc?.chequeDeposited || 0.00) + (doc?.schm || 0) + (doc?.ref || 0)).toFixed(2));

      agg.deposit += totalDeposit;
    };


    const summary = [];
    let gtCases = 0;
    let gtBottles = 0;
    let gtAmount = 0;
    let gtDeposit = 0;
    let gtShortExcess = 0;
    for (const [salesmanCode, data] of summaryMap) {
      const shortExcess = Number(parseFloat((data.deposit || 0) - (data.amount || 0)).toFixed(2));
      summary.push({
        salesmanCode,
        cases: data.cases,
        bottles: data.bottles,
        amount: data.amount,
        deposit: data.deposit,
        shortExcess
      })

      gtCases += data.cases;
      gtBottles += data.bottles;
      gtAmount += Number(data.amount || 0);
      gtDeposit += Number(data.deposit || 0);
      gtShortExcess += Number(data.shortExcess || 0);
    }

    res.status(200).json({
      success: true,
      summary,
      grandTotals: {
        gtcases,
        gtBottles,
        gtAmount: parseFloat(gtAmount.toFixed(2)),
        gtDeposit: parseFloat(gtDeposit.toFixed(2)),
        gtShortExcess: parseFloat(gtShortExcess.toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};