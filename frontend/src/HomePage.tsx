import { useState, useEffect } from "react";
import { ActiveRoomPage } from "./pages/ActiveRoomPage";
import { io} from "socket.io-client";
import "./App.css";


type UserSession = {
  id: string;
  name:string;
}
type Session = {
  id: string;
  users: UserSession[];
};



const socket = io("http://localhost:3001");
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

  const [roomInput, setRoomInput] = useState(roomFromUrl ?? "");
  const [currentActiveRoomID, setCurrentActiveRoomID] = useState<string | null>(roomFromUrl);
  const [makingRoom, setMakingRoom] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    socket.emit("sessions:getAll");

    socket.on("sessions:allSessions", (sessionsArray: Session[]) => {
      setSessions(sessionsArray);
    })
    return () => {
      socket.off("sessions:allSessions");
    }
  }, []);

  const roomInfo = currentActiveRoomID || makingRoom;

  if (roomInfo) {
    return (
        <ActiveRoomPage
            user={user}
            roomId={currentActiveRoomID}
            shouldCreateRoom={makingRoom}
            />
    );
  }

  const sessionsList = [];
  for (const session of sessions) {
    sessionsList.push(
      <div key ={session.id}>
        <p> Session: {session.id}</p>
        <p>Users: {session.users.map((user) => user.name).join()}</p>
        <button onClick={() => setCurrentActiveRoomID(session.id)}>Join</button>
      </div>
    )
  }

  return (
    <main className="home-page">
      
      <header>
        <h1>JamSync Live Prototype</h1>
        <p>You are {user.name}</p>
      </header>

       <section>
                <h2>Profile</h2>
                
            </section>

             <section>
                <h2>Sessions</h2>


     <button onClick={() => setMakingRoom(true)}> Create Session</button>

      <div className="join-box">
        <input 
                value={roomInput} onChange={(e)=> setRoomInput(e.target.value)}

                placeholder="Enter the Session Code" />
                <button onClick={() => {
                    const trimmedRoomInput = roomInput.trim();
                    if (trimmedRoomInput.length !== 0) {
                    setCurrentActiveRoomID(trimmedRoomInput)}}}>Join Session</button>
      </div>
      </section>
                  <section>
                <h2>Available Sessions</h2>
                {sessionsList}
                
            </section>
    </main>
  );
}