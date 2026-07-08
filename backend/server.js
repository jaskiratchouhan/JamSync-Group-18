import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      id: roomId,
      hostId: null,
      users: []
    };
  }

  return rooms[roomId];
}

function makeRoomUser(user, socket, isHost) {
  return {
    ...user,
    socketId: socket.id,
    isHost
  };
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("room:create", ({ user }) => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();

    const room = getRoom(roomId);

    room.hostId = user.id;

    room.users = room.users.filter((u) => u.id !== user.id);

    const newUser = makeRoomUser(user, socket, true);

    room.users.push(newUser);

    socket.join(roomId);

    socket.emit("room:created", {
      roomId,
      room
    });

    io.to(roomId).emit("room:update", room);
  });

  socket.on("room:join", ({ roomId, user }) => {
    const room = getRoom(roomId);

    room.users = room.users.filter((u) => u.id !== user.id);

    const newUser = makeRoomUser(
      user,
      socket,
      room.hostId === user.id
    );

    room.users.push(newUser);

    socket.join(roomId);

    socket.emit("room:joined", {
      roomId,
      room
    });

    io.to(roomId).emit("room:update", room);
  });

  socket.on("room:leave", ({ roomId, userId }) => {
    leaveRoom(socket, roomId, userId);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      const leavingUser = room.users.find(
        (u) => u.socketId === socket.id
      );

      if (leavingUser) {
        leaveRoom(socket, roomId, leavingUser.id);
      }
    }
  });
});

function leaveRoom(socket, roomId, userId) {
  const room = rooms[roomId];
  if (!room) return;

  room.users = room.users.filter((u) => u.id !== userId);

  socket.leave(roomId);

  if (room.hostId === userId) {
    room.hostId = room.users[0]?.id || null;

    room.users.forEach((u) => {
      u.isHost = u.id === room.hostId;
    });
  }

  if (room.users.length === 0) {
    delete rooms[roomId];
    return;
  }

  io.to(roomId).emit("room:update", room);
}

server.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});