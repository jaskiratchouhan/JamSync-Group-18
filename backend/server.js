import express from "express";
import axios from 'axios';
import {helpers} from './db.js';
import querystring from 'querystring'
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from 'dotenv';
dotenv.config();

// (async () => {
//     await helpers.init();
// })();

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

function makeRoomUser(user, socket, isHost) {
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

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("room:create", ({ user }) => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    const room = getRoom(roomId);

    room.hostId = user.id;

    // prevents duplicate users from React dev reload / StrictMode
    room.users = room.users.filter((u) => u.id !== user.id);

    const newUser = makeRoomUser(user, socket, true);

    room.users.push(newUser);
    socket.join(roomId);

    socket.emit("room:created", { roomId, room });
    io.to(roomId).emit("room:update", room);
  });

  socket.on("room:join", ({ roomId, user }) => {
    const room = getRoom(roomId);

    // prevents the same tab/user from appearing twice
    room.users = room.users.filter((u) => u.id !== user.id);

    const newUser = makeRoomUser(
      user,
      socket,
      room.hostId === user.id
    );

    room.users.push(newUser);
    socket.join(roomId);

    socket.emit("room:joined", { roomId, room });

    socket.to(roomId).emit("webrtc:user-joined", {
      userId: user.id,
      socketId: socket.id
    });

    io.to(roomId).emit("room:update", room);
  });

  socket.on("room:leave", ({ roomId, userId }, callback) => {
    leaveRoom(socket, roomId, userId);

    if (callback) {
      callback({ ok: true });
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

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const leavingUser = room.users.find((u) => u.socketId === socket.id);

      if (leavingUser) {
        leaveRoom(socket, roomId, leavingUser.id);
      }
    }
  });
});

function leaveRoom(socket, roomId, userId) {
  const room = rooms[roomId];
  if (!room) return;

  const leavingUser = room.users.find((u) => u.id === userId);
  room.users = room.users.filter((u) => u.id !== userId);

  socket.leave(roomId);

  if (leavingUser) {
    socket.to(roomId).emit("webrtc:user-left", {
      socketId: leavingUser.socketId,
      userId
    });
  }

  if (room.hostId === userId) {
    room.hostId = room.users[0]?.id || null;

    room.users.forEach((u) => {
        u.isHost = u.id === room.hostId;

        if (u.isHost) {
        u.isForceMuted = false;

        io.to(u.socketId).emit("voice:force-muted", {
            targetUserId: u.id,
            muted: false
        });
        }
    });
  }

  if (room.users.length === 0) {
    delete rooms[roomId];
    return;
  }

  io.to(roomId).emit("room:update", room);
}

// auth


const client_id = process.env.CLIENT_ID;

const client_secret = process.env.CLIENT_SECRET;

const frontEndUrl = process.env.FRONTEND_URL;
var redirect_uri = 'http://127.0.0.1:3001/auth/spotify/callback';

app.get('/auth/spotify', function(req, res) {

  var state = helpers.generateRandomString(16);
  var scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-modify';

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state,
      show_dialog: true,
    }));
});


app.get('/auth/spotify/callback', async function(req, res) {

  var code = req.query.code || null;
  var state = req.query.state || null;

  if (state === null) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };
  }

  try {
    const tokenResponse = await axios.post(authOptions.url, authOptions.form, {headers: authOptions.headers})
    console.log('Tokens:', tokenResponse.data)
    const {access_token, refresh_token, expires_in} = tokenResponse.data;
    const profileInfo = await axios.get("https://api.spotify.com/v1/me", {headers: {Authorization: `Bearer ${access_token}`}})

    const {account_id, email, display_name, images} = profileInfo.data;

    const avatar_url = images[0]?.url || null;
    const token_expires_at = new Date(Date.now() + expires_in * 1000);

    const user = await helpers.insertUser('spotify', email, account_id, display_name, avatar_url, access_token, refresh_token, token_expires_at)
    console.log('saved user:', user);
    const frontPageUrl = frontEndUrl + "/homepage";
    res.redirect(frontPageUrl);
  }
  catch(err) {
    console.error(err);
    res.status(500).send("Token exchange failed")
  }
});
// auth jam login
app.get("/auth/guest", async function(req,res) {
  try{
    const user = await helpers.insertBasicUser();
    res.redirect(`${frontEndUrl}/guest-welcome?guest_id=${user.id}&guest_name=${encodeURIComponent(user.display_name)}`)
  }
  catch(err){
    console.error(err);
    res.status(500).send("Failed to create guest user");
  }
  
})


server.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});