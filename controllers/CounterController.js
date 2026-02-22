import RealtimeCounterModel from "../models/RealtimeCounter.js";


const handleRealtimeCounter = async (req, res, next) => {
    try {
        const { seq } = req.body;

        if (typeof seq !== "number") {
            return res.status(400).json({ message: "Seq must be a number" });
        }

        const updatedCounter = await RealtimeCounterModel.findOneAndUpdate(
            {},
            { $inc: { seq } },
            { new: true, upsert: true }
        );

        res.status(200).json({
            message: `Seq incremented by ${seq}`,
            seq: updatedCounter.seq
        });
    } catch (error) {
        console.error("Error incrementing counter:", error);
        next(error);
    }
};


const handleGetRealtimeCounter = async (req, res, next) => {
    try {
        const getCounter = await RealtimeCounterModel.find();
        res.status(200).json({ seq: getCounter[0].seq || [] })
    } catch (error) {
        console.log("")
        next(error);
    }
}

export {
    handleRealtimeCounter,
    handleGetRealtimeCounter
}