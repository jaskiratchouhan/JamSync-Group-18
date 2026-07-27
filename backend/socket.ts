import {Server} from "socket.io";

export const io = new Server({
  cors: {
    origin: "http://127.0.0.1:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

export const onlineUsers = new Map<number, string>();