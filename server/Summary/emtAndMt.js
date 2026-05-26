import LoadOut from '../models/transaction/LoadOut.js';
import LoadIn from '../models/transaction/loadIn.js';
import { Item } from '../models/SKU.js';
import Salesman from '../models/salesman.js';
import { convertToQty, seperateCrate_Bottle, normalizeCasesBottles } from '../utils/normalizeQty.js';

export const EmtAndMtSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) return res.status(400).json({ message: "All field are required", success: false });

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const [loadouts, loadins, salesmans, items] = await Promise.all([
            LoadOut.find({ depo: req.user?.depo, date: { $gte: start, $lte: end } }),
            LoadIn.find({ depo: req.user?.depo, date: { $gte: start, $lte: end } }),
            Salesman.find({ depo: req.user?.depo }),
            Item.find({ depo: req.user?.depo }),
        ])

        const itemMap = new Map();
        for (const item of items) {
            itemMap.set(item.code.trim().toUpperCase(), item);
        }

        const salesmanMapDetails = new Map();
        for (const sm of salesmans) {
            salesmanMapDetails.set(sm.codeNo.trim().toUpperCase(), sm);
        }


        const summaryMap = new Map();

        for (const loadout of loadouts) {
            let mtCases = 0;
            let mtBottles = 0;
            for (const item of loadout.items) {
                const itemDoc = itemMap.get(item.itemCode.trim().toUpperCase());
                if (!itemDoc) continue;

                if (itemDoc.container.toLowerCase() === "mt" || itemDoc.container.toLowerCase() === "emt") {
                    const { cases, bottles } = seperateCrate_Bottle(item.qty, (itemDoc?.packOf || 24));
                    mtCases += cases;
                    mtBottles += bottles;
                }
            }
            if (!summaryMap.has(loadout.salesmanCode)) {
                summaryMap.set(loadout.salesmanCode, {
                    salesmanCode: loadout.salesmanCode,
                    totalMtCases: 0,
                    totalMtBottles: 0,
                    totalEmtCases: 0,
                    totalEmtBottles: 0
                });
            }

            let agg = summaryMap.get(loadout.salesmanCode);
            agg.totalMtCases += mtCases;
            agg.totalMtBottles += mtBottles;

        }

        for (const loadin of loadins) {
            let emtCases = 0;
            let emtBottles = 0;
            for (const item of loadin.items) {
                const itemDoc = itemMap.get(item.itemCode.trim().toUpperCase());
                if (!itemDoc) continue;
                if (itemDoc.container.toLowerCase() === "emt" || itemDoc.container.toLowerCase() === "mt") {
                    const { cases, bottles } = seperateCrate_Bottle(item.Emt, (itemDoc?.packOf || 24));
                    emtCases += cases;
                    emtBottles += bottles;
                }
            }

            if (!summaryMap.has(loadin.salesmanCode)) {
                summaryMap.set(loadin.salesmanCode, {
                    salesmanCode: loadin.salesmanCode,
                    totalMtCases: 0,
                    totalMtBottles: 0,
                    totalEmtCases: 0,
                    totalEmtBottles: 0
                });
            }
            let agg = summaryMap.get(loadin.salesmanCode);
            agg.totalEmtCases += emtCases;
            agg.totalEmtBottles += emtBottles;
        }

        const PACK = 24;
        const summary = [];
        let grandMtTotal = 0;   // total bottles across all salesmans
        let grandEmtTotal = 0;

        for (const [salesmanCode, data] of summaryMap) {
            const sm = salesmanMapDetails.get(salesmanCode.trim().toUpperCase());
            if (!sm) continue;

            // Normalize MT & EMT bottles overflow first
            const mt = normalizeCasesBottles(data.totalMtCases, data.totalMtBottles, PACK);
            const emt = normalizeCasesBottles(data.totalEmtCases, data.totalEmtBottles, PACK);

            // Convert to total bottles for accurate subtraction
            const mtTotalBottles = mt.cases * PACK + mt.bottles;
            const emtTotalBottles = emt.cases * PACK + emt.bottles;
            const diff = emtTotalBottles - mtTotalBottles;

            const isShort = diff < 0;
            const absDiff = Math.abs(diff);
            const diffCases = Math.floor(absDiff / PACK);
            const diffBottles = absDiff % PACK;

            summary.push({
                salesmanCode,
                name: sm.name,
                totalMt: `${mt.cases}.${String(mt.bottles).padStart(2, '0')}`,
                totalEmt: `${emt.cases}.${String(emt.bottles).padStart(2, '0')}`,
                shortExcess: `${isShort ? '-' : ''}${diffCases}.${String(diffBottles).padStart(2, '0')}`,
                shortExcessLabel: isShort ? 'Short' : 'Excess'
            });

            grandMtTotal += mtTotalBottles;
            grandEmtTotal += emtTotalBottles;
        }

        // Grand totals
        const grandMtCases = Math.floor(grandMtTotal / PACK);
        const grandMtBottles = grandMtTotal % PACK;
        const grandEmtCases = Math.floor(grandEmtTotal / PACK);
        const grandEmtBottles = grandEmtTotal % PACK;

        const grandDiff = grandEmtTotal - grandMtTotal;
        const grandIsShort = grandDiff < 0;
        const grandAbsDiff = Math.abs(grandDiff);
        const grandDiffCases = Math.floor(grandAbsDiff / PACK);
        const grandDiffBottles = grandAbsDiff % PACK;

        res.status(200).json({
            success: true,
            data: summary,
            grandTotal: {
                grandTotalMt: `${grandMtCases}.${String(grandMtBottles).padStart(2, '0')}`,
                grandTotalEmt: `${grandEmtCases}.${String(grandEmtBottles).padStart(2, '0')}`,
                grandTotalShortExcess: `${grandIsShort ? '-' : ''}${grandDiffCases}.${String(grandDiffBottles).padStart(2, '0')}`,
                grandShortExcessLabel: grandIsShort ? 'Short' : 'Excess'
            }
        })
    }
    catch (err) {
        console.error('Error in Emt/mt  summary:', err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}