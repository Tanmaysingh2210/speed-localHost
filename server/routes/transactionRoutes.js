import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import loadoutRoutes from './transactionRoutes/loadoutRoutes.js';
import loadinRoutes from './transactionRoutes/loadinRoutes.js';
import cashcreditRoutes from './transactionRoutes/cashcreditRoutes.js';
import LoadOut from '../models/transaction/LoadOut.js';
import Loadin from '../models/transaction/loadIn.js';
import Settlement from '../models/transaction/Settlement.js';
import Rate from '../models/rates.js';
import S_sheet from '../models/transaction/s_sheet.js';
import Depo from '../models/depoModal.js';
import { seperateCrate_Bottle, normalizeCasesBottles } from '../utils/normalizeQty.js';
import { Item } from '../models/SKU.js';

router.use('/loadout', loadoutRoutes);
router.use('/loadin', loadinRoutes);
router.use('/cashcredit', cashcreditRoutes);

router.post("/settlement", async (req, res) => {
    const normalize = v => typeof v === "string" ? v.trim().toLowerCase() : "";

    try {
        const { salesmanCode, date, trip } = req.body;

        if (!salesmanCode || !date || !trip) return res.status(400).json({ message: "All field required" });

        const depo = req.user?.depo;
        const saleDate = new Date(date);

        const [loadout, loadin, settlement, rates, items] = await Promise.all([
            LoadOut.findOne({ salesmanCode, date, trip, depo }),
            Loadin.findOne({ salesmanCode, date, trip, depo }),
            Settlement.find({ salesmanCode, date, trip, depo }),
            Rate.find({ depo, date: { $lte: saleDate } }).sort({ date: 1 }),
            Item.find({ depo })
        ]);

        if (!loadout)
            return res.status(404).json({ message: "No loadout found" });

        const rateMap = new Map();
        for (const r of rates) {
            if (!rateMap.has(normalize(r.itemCode))) {
                rateMap.set(normalize(r.itemCode), []);
            }
            rateMap.get(normalize(r.itemCode)).push(r);
        }

        const getRate = (code) => {
            code = normalize(code);
            const list = rateMap.get(code) || [];
            let chosen = null;
            for (const r of list) {
                if (r.date <= saleDate) chosen = r;
                else break;
            }
            return chosen;
        };


        let NetSale = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        let totalRefund = 0;

        const settlementMap = new Map();

        for (let lo of loadout.items) {

            const latestRate = getRate(lo.itemCode);
            if (!latestRate) continue;

            const basePrice = parseFloat((latestRate?.basePrice || 0).toFixed(2));
            const disc = basePrice * (latestRate?.perDisc || 0) / 100;
            const tax = (basePrice - disc) * (latestRate?.perTax || 0) / 100;
            const finalPrice = parseFloat((basePrice + tax - disc).toFixed(2));

            const item = items.find((i) => i.code === lo.itemCode);
            if (!item) { console.log("Item not found"); continue; }
            const pricePerBottle = parseFloat(finalPrice / item?.packOf).toFixed(2);

            const { cases, bottles } = seperateCrate_Bottle(lo.qty, item.packOf);
            console.log("cases", cases);
            console.log("bottles", bottles);

            if (!settlementMap.get(lo.itemCode)) {
                settlementMap.set(lo.itemCode, {
                    itemCode: lo.itemCode,
                    cases,
                    bottles,
                    loadedQty: lo.qty,
                    returnedQty: "0.0",
                    returnedCasesTotal: 0,
                    returnedBottlesTotal: 0,
                    finalQty: lo.qty,
                    finalCase: cases,
                    finalBottle: bottles,
                    basePrice,
                    tax,
                    disc,
                    finalPrice,
                    pricePerBottle,
                    taxAmount: 0,
                    discAmt: 0,
                    amount: 0
                })
            }
        }

        if (loadin) {
            for (const li of loadin.items) {
                console.log("li", li);

                const rate = getRate(li.itemCode);
                if (!rate) continue;

                const item = items.find((i) => i.code === li.itemCode);
                if (!item) { console.log("Item not found"); continue; }


                const base = rate.basePrice;
                const disc = base * (rate.perDisc || 0) / 100;
                const tax = (base - disc) * (rate.perTax || 0) / 100;
                const price = base - disc + tax;
                const pricePerBottle = parseFloat((price / item?.packOf)).toFixed(2);

                // Emt is stored as String in DB — "0" is truthy, so check numerically
                const emtVal = parseFloat(li.Emt) || 0;

                if (emtVal === 0) {
                    const { cases: filledCases, bottles: filledBottles } = seperateCrate_Bottle(parseFloat(li.Filled) || 0, item.packOf);
                    const { cases: burstCases, bottles: burstBottles } = seperateCrate_Bottle(parseFloat(li.Burst) || 0, item.packOf);

                    const { cases: returnedCases, bottles: returnedBottles } = seperateCrate_Bottle(`${filledCases + burstCases}.${filledBottles + burstBottles}`, item.packOf);


                    const agg = settlementMap.get(li.itemCode);
                    if (!agg) {
                        settlementMap.set(li.itemCode, {
                            itemCode: li.itemCode,
                            loadedQty: 0,
                            returnedQty: `${returnedCases}.${returnedBottles}`,
                            finalQty: `-${returnedCases}.${returnedBottles}`,
                            finalCase: -returnedCases,
                            finalBottle: -returnedBottles,
                            basePrice: base,
                            tax,
                            disc,
                            pricePerBottle,
                            finalPrice: parseFloat(price).toFixed(2),
                            taxAmount: 0,
                            discAmt: 0,
                            amount: 0
                        })
                    } else {

                        // Accumulate returned cases/bottles numerically across multiple loadin lines
                        agg.returnedCasesTotal = (agg.returnedCasesTotal || 0) + returnedCases;
                        agg.returnedBottlesTotal = (agg.returnedBottlesTotal || 0) + returnedBottles;

                        let finalCases = parseInt(agg.cases) - agg.returnedCasesTotal;
                        let finalBottles = parseInt(agg.bottles) - agg.returnedBottlesTotal;

                        // Borrow from cases when bottles go negative
                        const normalized = normalizeCasesBottles(finalCases, finalBottles, item.packOf);
                        finalCases = normalized.cases;
                        finalBottles = normalized.bottles;

                        agg.finalBottle = finalBottles;
                        agg.finalCase = finalCases;
                        agg.returnedQty = `${agg.returnedCasesTotal}.${agg.returnedBottlesTotal}`;
                        agg.finalQty = `${finalCases}.${finalBottles}`;
                    }
                } else {
                    const { cases: emtCases, bottles: emtBottles } = seperateCrate_Bottle(emtVal, item.packOf);
                    totalRefund += parseFloat((emtCases * price + emtBottles * parseFloat(pricePerBottle)).toFixed(2));
                }
            }
        }

        for (const entry of settlementMap.values()) {
            const finalQty = entry.finalQty;
            console.log("finalQty", finalQty);
            console.log("finalCase", entry.finalCase);
            console.log("finalBottle", entry.finalBottle);

            const caseAmount = (entry.finalCase) * (entry.finalPrice);
            const bottleAmount = (entry.finalBottle) * (entry.pricePerBottle);

            console.log("caseAmount", caseAmount);
            console.log("bottleAmount", bottleAmount);

            const caseDisc = (entry.finalCase) * (entry.disc);
            const bottleDisc = (entry.finalBottle) * (entry.disc);

            console.log("caseDisc", caseDisc);
            console.log("bottleDisc", bottleDisc);

            const caseTax = (entry.finalCase) * (entry.tax);
            const bottleTax = (entry.finalBottle) * (entry.tax);

            console.log("caseTax", caseTax);
            console.log("bottleTax", bottleTax);

            entry.amount = parseFloat((caseAmount + bottleAmount).toFixed(2));
            entry.discAmt = parseFloat((caseDisc + bottleDisc).toFixed(2));
            entry.taxAmount = parseFloat((caseTax + bottleTax).toFixed(2));

            NetSale += entry.amount;
            totalDiscount += entry.discAmt;
            totalTax += entry.taxAmount;
        }

        NetSale = parseFloat(NetSale.toFixed(2));
        totalTax = parseFloat(totalTax.toFixed(2));
        totalDiscount = parseFloat(totalDiscount.toFixed(2));
        totalRefund = parseFloat(totalRefund.toFixed(2));

        // settlement is an array (Settlement.find), grab first doc
        const settlementDoc = settlement[0] || null;
        let cashDeposited = parseFloat(settlementDoc?.cashDeposited || 0);
        let chequeDeposited = parseFloat(settlementDoc?.chequeDeposited || 0);
        let ref = parseFloat(settlementDoc?.ref || 0);
        let creditSale = parseFloat(settlementDoc?.credit || 0);
        let schm = parseFloat(settlementDoc?.schm || 0);

        const totalPayable = NetSale - totalRefund - schm - ref;
        const totalDeposited = parseFloat((cashDeposited + chequeDeposited + creditSale).toFixed(2));
        const shortOrExcess = parseFloat((totalDeposited - totalPayable).toFixed(2));
        const settlementItems = Array.from(settlementMap.values());

        return res.json({
            salesmanCode,
            date,
            trip,
            schm,
            items: settlementItems,
            remark: settlementDoc?.remark || "",

            totals: {
                NetSale,
                totalDiscount,
                totalTax,
                totalRefund,
                totalDeposited,
                shortOrExcess,
            },

            cashCreditDetails: {
                cashDeposited,
                chequeDeposited,
                creditSale,
                ref
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Settlement error", error: err.message });
    }
});



router.post("/settlement/update", async (req, res) => {
    try {
        const { date, salesmanCode, trip, ref, cashDeposited, chequeDeposited, credit, tax, remark, schm } = req.body;

        if (!date || !salesmanCode || !trip) return res.status(400).json({ message: "Required fields: date, salesmanCode, trip" });

        const depo = req.user?.depo;

        // Build update object with only provided fields
        const updateData = {};
        if (cashDeposited !== undefined) updateData.cashDeposited = cashDeposited;
        if (chequeDeposited !== undefined) updateData.chequeDeposited = chequeDeposited;
        if (credit !== undefined) updateData.credit = credit;
        if (tax !== undefined) updateData.tax = tax;
        if (schm !== undefined) updateData.schm = schm;
        if (remark !== undefined) updateData.remark = remark;
        if (ref !== undefined) updateData.ref = ref;

        const updated = await Settlement.findOneAndUpdate(
            { salesmanCode, date, trip, depo },
            { $set: updateData },
            { upsert: true, new: true }
        );

        res.status(201).json({ message: "settlement updated successfully", updated });
    } catch (err) {
        res.status(500).json({ message: "Error updating settlement", error: err.message });
    }
});

export default router;