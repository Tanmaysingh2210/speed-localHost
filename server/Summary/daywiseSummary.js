import LoadOut from '../models/transaction/LoadOut.js';
import LoadIn from '../models/transaction/loadIn.js';
import { Item } from '../models/SKU.js';
import Settlement from '../models/transaction/Settlement.js';
import Rates from '../models/rates.js';
import MtPrice from '../models/mtPrice.js';
import { seperateCrate_Bottle } from '../utils/normalizeQty.js';


export const DaywiseSummary = async (req, res) => {
    const normalize = v => typeof v === "string" ? v.trim().toLowerCase() : "";

    try {
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate || startDate > endDate) return res.status(400).json({ message: "Fill all fields properly", success: false });

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const [loadouts, loadins, settlements, rates, items, mtRates] = await Promise.all([
            LoadOut.find({ depo: req.user?.depo, date: { $gte: start, $lte: end } }).lean(),
            LoadIn.find({ depo: req.user?.depo, date: { $gte: start, $lte: end } }).lean(),
            Settlement.find({ depo: req.user?.depo, date: { $gte: start, $lte: end } }).lean(),
            Rates.find({ depo: req.user?.depo, date: { $lte: end } }).sort({ date: 1 }).lean(),
            Item.find({ depo: req.user?.depo }).lean(),
            MtPrice.find({ depo: req.user?.depo, date: { $lte: end } }).sort({ date: 1 }).lean()
        ]);

        // itemCode -> [rate1, rate2, ...] (sorted by date ASC)
        const rateMap = new Map();

        for (const r of rates) {
            const code = normalize(r.itemCode);
            if (!rateMap.has(code)) {
                rateMap.set(code, [])
            }
            rateMap.get(code).push(r);
        }

        const getRateforDate = (itemCode, saleDate) => {
            const list = rateMap.get(normalize(itemCode));
            if (!list) return null;
            let choosen = null;
            for (const r of list) {
                if (r.date <= saleDate) choosen = r;
                else break;
            }
            return choosen;
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


        const itemMap = new Map();
        for (const i of items) {
            const code = normalize(i.code);
            itemMap.set(code, {
                itemCode: code,
                container: normalize(i.container),
                packOf: i.packOf
            });
        }

        const dayMap = new Map();
        const getDayKey = d => d.toISOString().split("T")[0]; // yyyy-mm-dd
        const ensureDay = (date) => {
            const key = getDayKey(date);
            if (!dayMap.has(key)) {
                dayMap.set(key, {
                    date: key,
                    grossSale: 0,
                    credit: 0,
                    cash: 0,
                    cheque: 0,
                    refunds: 0,
                    disc: 0,
                    schm: 0,
                    ref: 0,
                    missingItems: []
                });
            }
            return dayMap.get(key);
        }

        for (const lo of loadouts) {
            const day = ensureDay(lo.date);
            for (const item of lo.items) {
                const matchedItem = itemMap.get(item.itemCode);
                if (!matchedItem) continue;

                const { cases, bottles } = seperateCrate_Bottle(item.qty, (matchedItem?.packOf || 24));

                if (matchedItem.container.toLowerCase() == "mt" || matchedItem.container.toLowerCase() == "emt") {
                    const latestMtPrice = getMtRate(lo.date, item.itemCode);
                    console.log("raTE", item.itemCode, latestMtPrice);
                    if (!latestMtPrice) continue;

                    const basePrice = parseFloat(((latestMtPrice.cratePrice || 0) + (latestMtPrice.emptyBottlePrice || 0) * (matchedItem.packOf || 24) + (latestMtPrice.drinkPrice || 0)).toFixed(2));
                    const disc = latestMtPrice.drinkPrice * (latestMtPrice?.perDisc || 0) / 100;
                    const tax = (latestMtPrice.drinkPrice - disc) * (latestMtPrice?.perTax || 0) / 100;
                    const finalPrice = parseFloat((basePrice + tax - disc).toFixed(2));

                    const pricePerBottle = Number(parseFloat(finalPrice / (matchedItem?.packOf || 24)).toFixed(2));
                    let amt = parseFloat((cases * finalPrice + bottles * pricePerBottle).toFixed(2));
                    day.grossSale += amt;
                } else {
                    const rate = getRateforDate(item.itemCode, lo.date);
                    if (!rate) continue;

                    const base = rate.basePrice;
                    const disc = (base * (rate.perDisc || 0)) / 100;
                    const tax = ((base - disc) * (rate.perTax || 0)) / 100;
                    const finalPrice = base - disc + tax;

                    const pricePerBottle = Number(parseFloat(finalPrice / (matchedItem?.packOf || 24)).toFixed(2));

                    let amt = parseFloat((cases * finalPrice + bottles * pricePerBottle).toFixed(2));

                    day.grossSale += amt;
                }

            }
        }

        for (const li of loadins) {
            const day = ensureDay(li.date);
            for (const item of li.items) {
                const it = itemMap.get(normalize(item.itemCode));
                if (!it) {
                    day.missingItems.push(normalize(item.itemCode));
                    continue;
                }

                if (normalize(it.container) === normalize("EMT") || normalize(it.container) === normalize("MT")) {
                    const latestMtPrice = getMtRate(li.date, item.itemCode);
                    console.log("raTE", item.itemCode, latestMtPrice);
                    if (!latestMtPrice) continue;

                    const basePrice = parseFloat(((latestMtPrice.cratePrice || 0) + (latestMtPrice.emptyBottlePrice || 0) * (it?.packOf || 24)).toFixed(2));
                    const pricePerBottle = Number(parseFloat(latestMtPrice.emptyBottlePrice || 0).toFixed(2));

                    const { cases, bottles } = seperateCrate_Bottle(item.Emt, (it?.packOf || 24));
                    let amt = parseFloat((cases * basePrice + bottles * pricePerBottle).toFixed(2));

                    day.refunds += amt;
                } else {
                    const rate = getRateforDate(normalize(item.itemCode), li.date);
                    if (!rate) {
                        continue;
                    };

                    const base = rate.basePrice;
                    const disc = (base * (rate.perDisc || 0)) / 100;
                    const tax = ((base - disc) * (rate.perTax || 0)) / 100;
                    const finalPrice = base - disc + tax;
                    const pricePerBottle = Number(parseFloat(finalPrice / (it?.packOf || 24)).toFixed(2));

                    const filled = Number(parseFloat((item?.Filled || 0)).toFixed(2));
                    const burst = Number(parseFloat((item?.Burst || 0)).toFixed(2));
                    const { cases, bottles } = seperateCrate_Bottle(filled + burst, (it?.packOf || 24));

                    let amt = parseFloat((cases * finalPrice + bottles * pricePerBottle).toFixed(2));
                    day.grossSale -= amt;
                }
            }
        }

        for (const cc of settlements) {
            const day = ensureDay(cc.date);
            day.cash += cc.cashDeposited || 0;
            day.cheque += cc.chequeDeposited || 0;
            day.ref += cc.ref || 0;
            day.credit += cc.credit || 0;
            day.schm += cc.schm || 0;
        }

        const summary = Array.from(dayMap.values()).map(d => {
            const deposited = d.cash + d.cheque;
            const shortExcess = deposited + d.schm + d.ref - d.grossSale;

            return {
                date: d.date,
                grossSale: Number(d.grossSale.toFixed(2)),
                cashDeposited: Number(d.cash.toFixed(2)),
                chequeDeposited: Number(d.cheque.toFixed(2)),
                creditSale: Number(d.credit.toFixed(2)),
                refund: Number(d.refunds.toFixed(2)),
                schm: Number((d.schm).toFixed(2)),
                shortExcess: Number(shortExcess.toFixed(2))
            };
        });

        summary.sort((a, b) => a.date.localeCompare(b.date));

        return res.json({
            success: true,
            data: summary
        });

    } catch (err) {
        console.error("Datewise summary error:", err);
        return res.status(500).json({
            message: "Summary error",
            error: err.message,
            success: false
        });
    }
};