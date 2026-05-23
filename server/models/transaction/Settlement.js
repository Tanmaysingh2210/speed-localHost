import mongoose from 'mongoose';

const SettlementSchema = new mongoose.Schema({
    salesmanCode: { type: String, required: true },
    trip: { type: Number, required: true },
    date: { type: Date, required: true },
    cashDeposited: { type: Number },
    chequeDeposited: { type: Number },
    credit: { type: Number },
    tax: { type: Number },
    ref: { type: Number },
    schm: { type: Number, default: 0 },
    remark: { type: String },
    depo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'depo-master',
        required: true
    },
}, { timestamps: false })

export default mongoose.model('Transaction_Settlement', SettlementSchema);