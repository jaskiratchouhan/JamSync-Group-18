import { useEffect, useState } from "react";
import { ActiveRoomPage } from "./pages/ActiveRoomPage";
import "./App.css";

const BACKEND_URL = "http://127.0.0.1:3001";

type Playlist = {
  id: string;
  name: string;
};

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

export default function HomePage() {
  const [user] = useState(makeRandomUser);
  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = params.get("room");
  const userId = params.get("userId");

  const [roomIdInput, setRoomIdInput] = useState(roomFromUrl ?? "");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomFromUrl);
  const [shouldCreateRoom, setShouldCreateRoom] = useState(false);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    fetch(`${BACKEND_URL}/api/playlists?userId=${userId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load playlists");
        return res.json();
      })
      .then((data) => {
        setPlatform(data.platform);
        setPlaylists(data.playlists);
      })
      .catch(() => {});
  }, [userId]);

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

      {platform && (
        <section className="playlists">
          <h2>{platform} playlists</h2>
          <ul>
            {playlists.map((playlist) => (
              <li key={playlist.id}>{playlist.name}</li>
            ))}
          </ul>
        </section>
      )}

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