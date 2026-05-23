import LoadOut from '../models/transaction/LoadOut.js';
import LoadIn from '../models/transaction/loadIn.js';
import Rates from '../models/rates.js';
import { Item } from '../models/SKU.js';
import { normalizeCasesBottles, seperateCrate_Bottle } from '../utils/normalizeQty.js';

export const ItemWiseSummary = async (req, res) => {
    const normalize = v => typeof v === "string" ? v.trim().toLowerCase() : "";

    try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Dates required" });

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        if (start > end) return res.status(400).json({ success: false, message: "Invalid date range" });

        const [loadouts, loadins, rates, items] = await Promise.all([
            LoadOut.find({ depo: req.user?.depo, date: { $gte: start, $lte: end } }),
            LoadIn.find({ depo: req.user?.depo, date: { $gte: start, $lte: end } }),
            Rates.find({ depo: req.user?.depo, date: { $lte: end } }).sort({ date: 1 }),
            Item.find({ depo: req.user?.depo })
        ]);

        const itemMap = new Map();
        for (const i of items) {
            const code = normalize(i.code);
            if (normalize(i.container) === normalize("emt")) continue;
            else {
                itemMap.set(code, {
                    itemCode: code,
                    name: i.name,
                    cases: 0,
                    bottles: 0,
                    amount: 0,
                    packOf: i.packOf || 0
                });
            }
        }

        const rateMap = new Map();
        for (const r of rates) {
            const code = normalize(r.itemCode);
            if (!rateMap.has(code)) {
                rateMap.set(code, [])
            }
            rateMap.get(code).push(r);
        };

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

        for (const loadout of loadouts) {
            for (const item of loadout.items) {
                const rate = getRateforDate(item.itemCode, loadout.date);
                if (!rate) continue;
                const it = itemMap.get(normalize(item.itemCode));
                if (!it) continue;
                const { cases, bottles } = seperateCrate_Bottle(item.qty, it?.packOf);

                const basePrice = rate.basePrice;
                const taxablePrice = basePrice - (basePrice * ((rate.perDisc || 0) / 100));
                const tax = taxablePrice * ((rate.perTax || 0) / 100);

                const finalPrice = taxablePrice + tax;
                const ratePerBottle = finalPrice / it.packOf;

                const caseAmount = finalPrice * cases;
                const bottleAmount = ratePerBottle * bottles;
                const finalAmount = parseFloat((caseAmount + bottleAmount).toFixed(2));

                const agg = itemMap.get(normalize(item.itemCode));
                if (!agg) continue;

                agg.amount += finalAmount;
                agg.cases += cases;
                agg.bottles += bottles;
                agg.packOf = it?.packOf || 0;
            }
        }

        for (const loadin of loadins) {
            for (const item of loadin.items) {
                const rate = getRateforDate(item.itemCode, loadin.date);
                if (!rate) continue;

                const it = itemMap.get(normalize(item.itemCode));
                if (!it) continue;

                const { cases: filledCases, bottles: filledBottles } = seperateCrate_Bottle(item.Filled, it?.packOf);
                const { cases: burstCases, bottles: burstBottles } = seperateCrate_Bottle(item.Burst, it?.packOf);

                const cases = filledCases + burstCases;
                const bottles = filledBottles + burstBottles;

                const basePrice = rate.basePrice;
                const taxablePrice = basePrice - (basePrice * ((rate.perDisc || 0) / 100));
                const tax = taxablePrice * ((rate.perTax || 0) / 100);

                const finalPrice = taxablePrice + tax;
                const ratePerBottle = finalPrice / it.packOf;

                const caseAmount = finalPrice * cases;
                const bottleAmount = ratePerBottle * bottles;
                const finalAmount = parseFloat((caseAmount + bottleAmount).toFixed(2));

                const agg = itemMap.get(normalize(item.itemCode));
                if (!agg) continue;


                agg.cases -= cases ? cases : 0;
                agg.bottles -= bottles ? bottles : 0;
                agg.amount -= finalAmount;
                agg.packOf = it?.packOf || 0;
            }
        }

        const summary = [];
        let grandTotalCases = 0;
        let grandTotalBottles = 0;
        let grandTotalAmount = 0;

        for (const [itemCode, data] of itemMap) {

            const { cases, bottles } = normalizeCasesBottles(data.cases, data.bottles, data.packOf);

            summary.push({
                itemCode,
                name: data.name,
                cases: cases,
                bottles: bottles,
                amount: parseFloat(data.amount).toFixed(2)
            });

            grandTotalCases += cases;
            grandTotalBottles += bottles;
            grandTotalAmount += data.amount;
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

    }
    catch (err) {
        console.error('Error in itemwise summary:', err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
}