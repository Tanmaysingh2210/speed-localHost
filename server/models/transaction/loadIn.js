import mongoose from "mongoose"

const LoadInSchema = new mongoose.Schema({
  salesmanCode: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  trip: {
    type: Number,
    default: 1
  },
  depo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'depo-master',
    required: true
  },
  items: [
    {
      itemCode: { type: String, required: true },
      Filled: { type: String, default: 0 },
      Burst: { type: String, default: 0 },
      Emt: { type: String, default: 0 }
    }
  ],
},
  { timestamps: false })

export default mongoose.model('transaction_LoadIn', LoadInSchema);

