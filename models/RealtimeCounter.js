import mongoose from "mongoose";

const RealtimeCounter = new mongoose.Schema({
  seq: { type: Number, default: 0 },
});

const RealtimeCounterModel = mongoose.model("counters", RealtimeCounter);

export default RealtimeCounterModel;
