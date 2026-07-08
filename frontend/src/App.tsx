import { useState } from "react";
import { ActiveRoomPage } from "./pages/ActiveRoomPage";
import "./App.css";

function makeRandomUser() {
  const id = crypto.randomUUID();

  const colors = [
    "#FF8A80",
    "#FFB74D",
    "#FFF176",
    "#81C784",
    "#4DD0E1",
    "#64B5F6",
    "#BA68C8"
  ];

  const adjectives = [
  "Anonymous",
  "Happy",
  "Chill",
  "Sneaky",
  "Brave",
  "Lucky",
  "Cosmic",
  "Jolly",
  "Quiet",
  "Wild"
];

const animals = [
  "Giraffe",
  "Panda",
  "Tiger",
  "Koala",
  "Fox",
  "Otter",
  "Penguin",
  "Falcon",
  "Dolphin",
  "Bear"
];

function makeRandomName() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(1000 + Math.random() * 9000);

  return `${adjective} ${animal} ${number}`;
}

  return {
    id,
    name: makeRandomName(),
    color: colors[Math.floor(Math.random() * colors.length)]
  };
}

export default function App() {
  const [user] = useState(makeRandomUser);
  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = params.get("room");

  const [roomIdInput, setRoomIdInput] = useState(roomFromUrl ?? "");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomFromUrl);
  const [shouldCreateRoom, setShouldCreateRoom] = useState(false);

  if (activeRoomId || shouldCreateRoom) {
    return (
      <ActiveRoomPage
        user={user}
        roomId={activeRoomId}
        shouldCreateRoom={shouldCreateRoom}
      />
    );
  }

  return (
    <main className="home-page">
      <h1>JamSync Live Prototype</h1>
      <p>You are {user.name}</p>

      <button onClick={() => setShouldCreateRoom(true)}>
        Create Chat
      </button>

      <div className="join-box">
        <input
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          placeholder="Enter room code"
        />

        <button
          onClick={() => {
            if (roomIdInput.trim()) {
              setActiveRoomId(roomIdInput.trim());
            }
          }}
        >
          Enter Chat
        </button>
      </div>
    </main>
  );
}