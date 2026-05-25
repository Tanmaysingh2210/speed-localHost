import MtPrice from "../../models/mtPrice.js";

export const addMtPrice = async (req, res) => {
    try {
        const depo = req.user?.depo;
        const { itemCode, date, cratePrice, emptyBottlePrice, drinkPrice, perTax, perDisc, status } = req.body;
        const code = itemCode.trim().toUpperCase();
        if (!code || !date || cratePrice == null || !emptyBottlePrice || !drinkPrice) return res.status(400).json({ message: "Fill entries properly!" });

        const exist = await MtPrice.findOne({ itemCode: code, depo, date });
        if (exist) return res.status(400).json({ message: "MtPrice already exist for this item and date!" });


        await MtPrice.updateMany(
            { itemCode: code, depo },
            { $set: { status: "Inactive" } } // Set them to Inactive
        );

        const added = await MtPrice.create({
            itemCode: code,
            depo,
            date,
            cratePrice,
            emptyBottlePrice,
            drinkPrice,
            perTax: perTax || 0,
            perDisc: perDisc || 0,
            status: status || "Active"
        });

        res.status(200).json({ message: "MtPrice added successfully!", data: added });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllMtPrice = async (req, res) => {
    try {
        const depo = req.user.depo;
        const mtPrices = await MtPrice.find({ depo });
        if (!mtPrices) return res.status(404).json({ message: "MtPrice not found!" });
        res.status(200).json({ message: "MtPrice fetched successfully!", data: mtPrices });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const updateMtPrice = async (req, res) => {
    try {
        const depo = req.user.depo;
        const updated = await MtPrice.findOneAndUpdate(
            { _id: req.params.id, depo },
            req.body,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: "MtPrice not found!" });
        res.status(200).json({ message: "MtPrice updated successfully!", data: updated });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteMtPrice = async (req, res) => {
    try {
        const depo = req.user?.depo;
        const deleted = await MtPrice.findOneAndDelete(
            { _id: req.params.id, depo },
        );
        if (!deleted) return res.status(404).json({ message: "MtPrice not found!" });
        res.status(200).json({ message: "MtPrice deleted successfully!", data: deleted });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error" });
    }
};
