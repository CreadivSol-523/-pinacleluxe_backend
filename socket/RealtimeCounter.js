import CounterModel from "../models/RealtimeCounter.js";
import connectedUsers from "./ConnectedUsers.js";

export const UpdateGlobalCounter = (userID, socket, io) => {
  socket.on("update-seq", async ({ seq }) => {
    try {
      if (typeof seq !== "number") {
        socket.emit("update-seq", {
          message: "A numeric 'seq' value is required.",
          success: false,
        });
        return;
      }
      const updatedCounter = await CounterModel.findOneAndUpdate(
        {},
        { $set: { seq } },
        { new: true, upsert: true }
      );
      io.emit("global-seq-updated", {
        message: "Global counter updated successfully.",
        seq: updatedCounter.seq,
        success: true,
      });
    } catch (error) {
      console.error("Error updating counter:", error);
      socket.emit("update-seq", {
        message: "Something went wrong while updating counter.",
        success: false,
      });
    }
  });
};
