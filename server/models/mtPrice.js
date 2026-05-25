import mongoose from "mongoose";

const mtPrice = new mongoose.Schema({
    itemCode: { type: String, required: true },
    cratePrice: { type: Number, required: true },
    emptyBottlePrice: { type: Number, required: true },
    drinkPrice: { type: Number, required: true },
    perTax: { type: Number, default: 0 },
    perDisc: { type: Number, default: 0 },
    date: { type: Date, required: true },
    depo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'depo-master',
        required: true
    },
    status: { type: String, default: 'Active' }
});

mtPrice.index({ depo: 1, itemCode: 1, date: 1 }, { unique: true });

export default mongoose.model("emtPrice", mtPrice);