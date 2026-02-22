import mongoose from "mongoose";
import connectedUsers from "./ConnectedUsers.js";
import { UpdateGlobalCounter } from "./RealtimeCounter.js";

const SocketWrapper = (io) => {
  io.on("connection", (socket) => {
    const userID = socket.handshake.query.userID;
    console.log("Connected to socket.io");

    socket.on("setup", ({ userID, deviceId }) => {
      console.log(userID, deviceId);
      socket.join(userID);

      if (!connectedUsers[userID]) {
        connectedUsers[userID] = {};
      }

      connectedUsers[userID][deviceId] = socket.id;

      socket.userID = userID;
      socket.deviceId = deviceId;

      console.log(`${userID} connected from device ${deviceId}`);
    });


    UpdateGlobalCounter(userID, socket, io)

    socket.on("disconnect", () => {
      const { userID, deviceId } = socket;
      if (userID && deviceId && connectedUsers[userID]) {
        delete connectedUsers[userID][deviceId];

        if (Object.keys(connectedUsers[userID]).length === 0) {
          delete connectedUsers[userID];
        }

        console.log(`Disconnected session: User ${userID}, Device ${deviceId}`);
      } else {
        console.log("Disconnected unknown socket/session");
      }
    });
  });
};

export { SocketWrapper, connectedUsers };
