import {helpers} from './db.ts';
// import querystring from 'querystring'
import http from "http";
// import cors from "cors";
import { Server, Socket} from "socket.io";
// import {pool} from "./db";
// import session from 'express-session';
// import connectPgSimple from 'connect-pg-simple';
// import dotenv from 'dotenv';
import app, {sessionSetUp} from "./app.ts";
import {io, onlineUsers} from "./socket.ts";

const server = http.createServer(app);
io.attach(server);

io.engine.use(sessionSetUp);

type RoomUser = {
  id: string | number;
  dbUserId: number;
  name: string;
  color?: string;
  socketId: string;
  isHost: boolean;
  isSelfMuted: boolean;
  isForceMuted: boolean;
  speaking: boolean;
  transcript: string;
  lastTranscriptAt?: number;
};

type Room = {
  id: string;
  dbSessionId: number | null;
  hostId: string | number | null;
  users: RoomUser[];
  music: {
    title: string;
    artist: string;
    playing: boolean;
    currentTime: number;
  };
};

const rooms: Record<string, Room> = {};
// storing userID of active users
// const onlineUsers = new Map<number, string>();

function getRoom(roomId: string): Room {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      id: roomId,
      dbSessionId: null,
      hostId: null,
      users: [],
      music: {
        title: "Default JamSync Song",
        artist: "Prototype Artist",
        playing: false,
        currentTime: 0
      }
    };
  }

  return rooms[roomId];
}

function makeRoomUser(
  user: {id: string | number; dbUserId: number; name: string; color?: string},
  socket: Socket,
  isHost: boolean
): RoomUser {
  return {
    ...user,
    socketId: socket.id,
    isHost,
    isSelfMuted: false,
    isForceMuted: false,
    speaking: false,
    transcript: ""
  };
}

function providingListofSessions() {
  const sessionsArray = [];
  for (const room of Object.values(rooms)) {
      sessionsArray.push({
        id:room.id,
        users: room.users.map((user) => ({
          id: user.id,
          name: user.name
        }))
          
        
        
      });
    }
    io.emit("sessions:allSessions", sessionsArray)
  }

  async function providingUserSessions(userId:number) {
    const sessions = await helpers.getUserCurrentSessions(userId);

    for (const client of io.sockets.sockets.values()) {
      if(client.data.userId ===userId) {
        client.emit("user:sessions",sessions);
      }
    }
    //socket.emit("user:sessions", sessions);
  }


io.on("connection", (socket) => {
  socket.on("sessions:getAll", () => {
    providingListofSessions();
  });

  socket.on("user:sessions:get", async({userId}) => {
    socket.data.userId = userId;

    const sessions = await helpers.getUserCurrentSessions(userId);
    socket.emit("user:sessions", sessions)
  })

  console.log("Connected:", socket.id);

  socket.on("room:create", async ({user}: {
    user: {
      id: string | number;
      dbUserId: number;
      name: string;
      color?: string;
    };
  }) => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    const room = getRoom(roomId);

    room.hostId = user.id;

    const dbSession = await helpers.insertSession(
      roomId,
      user.dbUserId,
      `${user.name}'s Session`
    );

    if (!dbSession){
      socket.emit("room:error", {error: "Could not save session."});
      return;
    }

    room.dbSessionId = dbSession.id;

    await helpers.insertSessionMember(dbSession.id, user.dbUserId);

    await providingUserSessions(user.dbUserId)
    room.users = room.users.filter((u) => u.id !== user.id);

    const newUser = makeRoomUser(user, socket, true);

    room.users.push(newUser);
    socket.join(roomId);

    socket.emit("room:created", {roomId, room});
    io.to(roomId).emit("room:update", room);
    providingListofSessions();
  });

  
  socket.on("room:join", async ({
    roomId,
    user
  }: {
    roomId: string;
    user: {
      id: string | number;
      dbUserId: number;
      name: string;
      color?: string;
    };
  }) => {
    const room = rooms[roomId];

    if (!room){
      socket.emit("room:error", {error: "Room does not exist."});
      return;
    }

    if (room.dbSessionId){
      await helpers.insertSessionMember(room.dbSessionId, user.dbUserId);
      await providingUserSessions(user.dbUserId)
    }

    room.users = room.users.filter((u) => u.id !== user.id);

    const newUser = makeRoomUser(user, socket, room.hostId === user.id);

    room.users.push(newUser);
    socket.join(roomId);

    socket.emit("room:joined", {roomId, room});

    socket.to(roomId).emit("webrtc:user-joined", {
      userId: user.id,
      socketId: socket.id
    });

    io.to(roomId).emit("room:update", room);
    providingListofSessions();
  });

  socket.on("room:leave", async ({roomId, userId}, callback) => {
    await leaveRoom(socket, roomId, userId);

    if (callback){
      callback({ok: true});
    }
  });

  socket.on("voice:self-muted", ({ roomId, userId, muted }) => {
    const room = rooms[roomId];
    if (!room) return;

    const user = room.users.find((u) => u.id === userId);
    if (!user) return;

    user.isSelfMuted = muted;
    io.to(roomId).emit("room:update", room);
  });

  socket.on("voice:force-muted", ({ roomId, targetUserId, requesterId, muted }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId !== requesterId) return;

    const target = room.users.find((u) => u.id === targetUserId);
    if (!target) return;

    target.isForceMuted = muted;

    io.to(roomId).emit("voice:force-muted", {
      targetUserId,
      muted
    });

    io.to(roomId).emit("room:update", room);
  });

  socket.on("voice:speaking", ({ roomId, userId, speaking }) => {
    const room = rooms[roomId];
    if (!room) return;

    const user = room.users.find((u) => u.id === userId);
    if (!user) return;

    user.speaking = speaking;
    io.to(roomId).emit("room:update", room);
  });

  socket.on("voice:transcript", ({ roomId, userId, transcript }) => {
    const room = rooms[roomId];
    if (!room || !transcript?.trim()) return;

    const user = room.users.find((u) => u.id === userId);
    if (!user) return;

    const cleanTranscript = transcript.trim();

    if (user.transcript === cleanTranscript) return;

    user.transcript = cleanTranscript;
    user.lastTranscriptAt = 0;

    io.to(roomId).emit("room:update", room);

    const thisTranscriptTime = user.lastTranscriptAt;

    setTimeout(() => {
      const latestRoom = rooms[roomId];
      if (!latestRoom) return;

      const latestUser = latestRoom.users.find((u) => u.id === userId);
      if (!latestUser) return;

      if (latestUser.lastTranscriptAt !== thisTranscriptTime) return;

      latestUser.transcript = "";
      io.to(roomId).emit("room:update", latestRoom);
    }, 2500);
  });

  socket.on("music:action", ({ roomId, requesterId, action }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId !== requesterId) return;

    if (action === "play") {
      room.music.playing = true;
    }

    if (action === "pause") {
      room.music.playing = false;
    }

    if (action === "skip") {
      room.music = {
        title: "Next Default Song",
        artist: "JamSync Bot",
        playing: true,
        currentTime: 0
      };
    }

    if (action === "back") {
      room.music = {
        title: "Previous Default Song",
        artist: "JamSync Bot",
        playing: true,
        currentTime: 0
      };
    }

    io.to(roomId).emit("room:update", room);
  });

  socket.on("webrtc:offer", ({ targetSocketId, offer, fromSocketId }) => {
    io.to(targetSocketId).emit("webrtc:offer", {
      offer,
      fromSocketId
    });
  });

  socket.on("webrtc:answer", ({ targetSocketId, answer, fromSocketId }) => {
    io.to(targetSocketId).emit("webrtc:answer", {
      answer,
      fromSocketId
    });
  });

  socket.on("webrtc:ice-candidate", ({ targetSocketId, candidate, fromSocketId }) => {
    io.to(targetSocketId).emit("webrtc:ice-candidate", {
      candidate,
      fromSocketId
    });
  });

  // socket checking if users are online

  const session = (socket.request as any).session;
  const userID = session?.user?.userId ? Number(session.user.userId) : null;
  console.log("socket connected, userID:", userID);
  if (userID){
    onlineUsers.set(userID, socket.id);
    io.emit("status:update", {userID, online: true})
  }

  socket.on("disconnect", async () => {
    console.log("Disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      console.log("Checking room:", roomId);
      console.log("Current room users:", room.users);

      const leavingUser = room.users.find((u) => u.socketId === socket.id);

      console.log("Leaving user found:", leavingUser);

      if (leavingUser) {
        await leaveRoom(socket, roomId, leavingUser.id);
      }
    }

    if (userID){
      onlineUsers.delete(userID);
      io.emit("status:update", {userID, online: false});
    }
  });
});

async function leaveRoom(
  socket: Socket,
  roomId: string,
  userId: string | number
) {
  const room = rooms[roomId];
  if (!room) return;

  const leavingUser = room.users.find((u) => u.id === userId);

  room.users = room.users.filter((u) => u.id !== userId);

  socket.leave(roomId);

  if (leavingUser){
    socket.to(roomId).emit("webrtc:user-left", {
      socketId: leavingUser.socketId,
      userId
    });

    if (room.dbSessionId){
      const sameUserStillPresent = room.users.some(
        (u) => u.dbUserId === leavingUser.dbUserId
      );

      if (!sameUserStillPresent){
        await helpers.deleteSessionMember(
          room.dbSessionId,
          leavingUser.dbUserId
        );
        await providingUserSessions(leavingUser.dbUserId)
      }
    }
  }

  if (room.hostId === userId){
    room.hostId = room.users[0]?.id || null;

    room.users.forEach((u) => {
      u.isHost = u.id === room.hostId;

      if (u.isHost){
        u.isForceMuted = false;

        io.to(u.socketId).emit("voice:force-muted", {
          targetUserId: u.id,
          muted: false
        });
      }
    });
  }

  if (room.users.length === 0){
    if (room.dbSessionId){
      await helpers.deleteSession(room.dbSessionId);
    }

    delete rooms[roomId];
    providingListofSessions();
    return;
  }

  io.to(roomId).emit("room:update", room);
  providingListofSessions();
}
//

/**
 * @openapi
 *  /api/recent_sessions:
 *    get:
 *      summary: Finds the user's currently joined sesssions.
 *      tags: [Session]
 *      responses: 
 *        200:
 *          description: Lists the current sessions of the user.
 *        401:
 *          description: The user is not currently authenticated.
 *        500:
 *          description: Couldn't get the current sessions list.
 */
app.get('/api/recent_sessions', async function(req, res) {

  if (!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const userId = Number(req.session.user.userId);


  try {
    const sessions = await helpers.getUserCurrentSessions(userId)

    return res.json(sessions);
  } catch(err) {
    console.error("Unable to get user's sessions:", err);
    return res.status(500).json({
      error: "Unable to get user's sessions"
    })
  }
})

export {server, rooms};

if (process.env.NODE_ENV !== "test") {
  server.listen(3001, () => {
    console.log("Backend running on http://localhost:3001");
  });
}