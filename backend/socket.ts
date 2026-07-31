import {Server} from "socket.io";
import dotenv from 'dotenv';
dotenv.config();

export const io = new Server({
  cors: {
    origin: process.env.FRONTEND_URL || "http://127.0.0.1:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

export const onlineUsers = new Map<number, string>();