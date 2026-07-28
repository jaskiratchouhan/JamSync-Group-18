import { after, afterEach, before, describe, it, mock } from "node:test";

import assert from "node:assert/strict";
import {io as createClient, Socket} from "socket.io-client";

import {helpers} from "../db.ts";
import {server, rooms} from "../server.ts";

let port: number;
const clients: Socket[] = [];

function connectClient(): Promise<Socket> {
  return new Promise((resolve) => {
    const socket = createClient(`http://127.0.0.1:${port}`);
    clients.push(socket);
    socket.once("connect", () => resolve(socket));
  });
}

function waitFor(socket: Socket, event: string): Promise<any> {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function createRoom(socket: Socket, id: string, dbUserId: number) {
  const created = waitFor(socket, "room:created");

  socket.emit("room:create", {
    user: {id, dbUserId, name: "Test User"}
  });

  return created;
}

before(async () => {
  mock.method(helpers, "insertSession", async () => ({id: 1}));
  mock.method(helpers, "insertSessionMember", async () => undefined);
  mock.method(helpers, "deleteSessionMember", async () => undefined);
  mock.method(helpers, "deleteSession", async () => undefined);
  mock.method(helpers, "getUserCurrentSessions", async () => []);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as any).port;
});

afterEach(() => {
  clients.splice(0).forEach((socket) => socket.disconnect());

  for (const roomId of Object.keys(rooms)) {
    delete rooms[roomId];
  }
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  mock.restoreAll();
});

describe("Sessions", () => {
    it("returns the active sessions array", async () => {
        const socket = await connectClient();
        const sessions = waitFor(socket, "sessions:allSessions");

        socket.emit("sessions:getAll");

        assert.ok(Array.isArray(await sessions));
    });

    it("creates a new room", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host1", 1);

        assert.ok(result.roomId);
    });

    it("creates a six digit room code", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host2", 2);

        assert.match(result.roomId, /^\d{6}$/);
    });

    it("makes the creator the host", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host3", 3);

        assert.equal(result.room.hostId, "host3");
    });

    it("adds the creator to the room", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host4", 4);

        assert.equal(result.room.users.length, 1);
    });

    it("starts the room music paused", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host5", 5);

        assert.equal(result.room.music.playing, false);
    });

    it("rejects an invalid room code", async () => {
        const socket = await connectClient();
        const error = waitFor(socket, "room:error");

        socket.emit("room:join", {
        roomId: "invalid",
        user: {id: "guest1", dbUserId: 6, name: "Guest"}
        });

        assert.equal((await error).error, "Room does not exist.");
    });

    it("allows another user to join", async () => {
        const host = await connectClient();
        const {roomId} = await createRoom(host, "host6", 7);

        const guest = await connectClient();
        const joined = waitFor(guest, "room:joined");

        guest.emit("room:join", {
        roomId,
        user: {id: "guest2", dbUserId: 8, name: "Guest"}
        });

        assert.equal((await joined).room.users.length, 2);
    });

    it("updates a user's mute status", async () => {
        const socket = await connectClient();
        const {roomId} = await createRoom(socket, "host7", 9);

        const updated = new Promise<any>((resolve) => {
            socket.on("room:update", (room) => {
                if (room.users[0]?.isSelfMuted === true) {
                    resolve(room);
                }
            });
        });

        socket.emit("voice:self-muted", {
            roomId,
            userId: "host7",
            muted: true
        });

        assert.equal((await updated).users[0].isSelfMuted, true);
    });

    it("removes a room after the final user leaves", async () => {
        const socket = await connectClient();
        const {roomId} = await createRoom(socket, "host8", 10);

        await new Promise<void>((resolve) => {
        socket.emit("room:leave", {roomId, userId: "host8"}, resolve);
        });

        assert.equal(rooms[roomId], undefined);
    });

    it("should create an empty transcript", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host9", 11);

        assert.equal(result.room.users[0].transcript, "");
    });

    it("should create users as not speaking", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host10", 12);

        assert.equal(result.room.users[0].speaking, false);
    });

    it("should create users as not self muted", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host11", 13);

        assert.equal(result.room.users[0].isSelfMuted, false);
    });

    it("should create users as not force muted", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host12", 14);

        assert.equal(result.room.users[0].isForceMuted, false);
    });

    it("should create rooms with no current music time", async () => {
        const socket = await connectClient();
        const result = await createRoom(socket, "host13", 15);

        assert.equal(result.room.music.currentTime, 0);
    }); 
});