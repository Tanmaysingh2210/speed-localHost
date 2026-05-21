import PurchaseItemwise from '../../models/purchase/PurchaseItemwise.js';
import { Item } from '../../models/SKU.js';
import { normalizeQty } from '../../utils/normalizeQty.js';

export const createPurchaseItemwise = async (req, res) => {
    try {
        const { date, items } = req.body;


        if (!date || !items || items.length === 0) {
            return res.status(400).json({
                message: 'Please provide date and items'
            });
        }
        const depo = req.user?.depo;

        for (let item of items) {
            if (!item.itemCode || !item.qty || !item.expiryDate) {
                return res.status(400).json({
                    message: 'Each item must have itemCode, qty, and expiryDate'
                });
            }
        }

        const normalizedItems = await Promise.all(items.map(async (item) => {
            const sku = await Item.findOne({ code: item.itemCode.toUpperCase(), depo });
            if (!sku) throw new Error(`Item ${item.itemCode} not found in SKU`);

            const normalizedQty = normalizeQty(Number(item.qty), sku.packOf);

            return {
                itemCode: item.itemCode.toUpperCase(),
                qty: normalizedQty,
                remainingQty: normalizedQty,
                expiryDate: item.expiryDate
            };
        }));

        const newPurchase = new PurchaseItemwise({
            date,
            depo,
            items: normalizedItems
        });

        const savedPurchase = await newPurchase.save();

        res.status(201).json({
            message: 'Purchase itemwise created successfully',
            data: savedPurchase
        });

    } catch (error) {
        console.error('Error creating purchase itemwise:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

export const getAllPurchaseItemwise = async (req, res) => {
    try {
        const purchases = await PurchaseItemwise.find({ depo: req.user?.depo }).sort({ date: -1 });

        res.status(200).json({
            message: 'Purchase itemwise fetched successfully',
            count: purchases.length,
            data: purchases
        });

    } catch (error) {
        console.error('Error fetching purchase itemwise:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

export const getPurchaseItemwiseById = async (req, res) => {
    try {
        const purchase = await PurchaseItemwise.findOne({ _id: req.params.id, depo: req.user?.depo });

        if (!purchase) {
            return res.status(404).json({
                message: 'Purchase itemwise not found'
            });
        }

        res.status(200).json({
            message: 'Purchase itemwise fetched successfully',
            data: purchase
        });

    } catch (error) {
        console.error('Error fetching purchase itemwise:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

export const updatePurchaseItemwise = async (req, res) => {
    try {
        const { items, ...rest } = req.body;
        let updatePayload = { ...rest };
        const depo = req.user?.depo;

        if (Array.isArray(items) && items.length > 0) {
            const normalizedItems = await Promise.all(items.map(async (item) => {
                const sku = await Item.findOne({ code: item.itemCode.toUpperCase(), depo });
                if (!sku) return item; // fallback
                const normalizedQty = normalizeQty(Number(item.qty), sku.packOf);
                return {
                    ...item,
                    itemCode: item.itemCode.toUpperCase(),
                    qty: normalizedQty,
                    remainingQty: item.remainingQty ?? normalizedQty // preserve remainingQty if already set
                };
            }));
            updatePayload = { ...updatePayload, items: normalizedItems };
        }


        const updatedPurchase = await PurchaseItemwise.findOneAndUpdate(
            { _id: req.params.id, depo },
            updatePayload,
            { new: true, runValidators: true }
        );

        if (!updatedPurchase) return res.status(404).json({ message: 'Purchase itemwise not found' });

        res.status(200).json({
            message: 'Purchase itemwise updated successfully',
            data: updatedPurchase
        });

    } catch (error) {
        console.error('Error updating purchase itemwise:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// DELETE - Delete Purchase Itemwise
export const deletePurchaseItemwise = async (req, res) => {
    try {
        const deletedPurchase = await PurchaseItemwise.findOneAndDelete({ _id: req.params.id, depo: req.user?.depo });

        if (!deletedPurchase) {
            return res.status(404).json({
                message: 'Purchase itemwise not found'
            });
        }

        res.status(200).json({
            message: 'Purchase itemwise deleted successfully',
            data: deletedPurchase
        });

    } catch (error) {
        console.error('Error deleting purchase itemwise:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};