
import { useState, useEffect } from "react";
import toast from 'react-hot-toast';

import { ActiveRoomPage } from "./pages/ActiveRoomPage";
import { io} from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./App.css";

type Profile = {
  id: number;
  email: string,
  display_name: string;
  avatar_url: string | null;
  platform: string;

}

type UserSession = {
  id: string;
  name:string;
}
type Session = {
  id: string;
  users: UserSession[];
};



const socket = io("http://127.0.0.1:3001");

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
  //const [user] = useState(makeRandomUser);
  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = params.get("room");
  const userId = params.get("userId");
  const guestId = params.get("guest_id");
  const dbUserId = Number(userId ?? guestId);
  const navigate = useNavigate();

  const [user] = useState(() => ({
    ...makeRandomUser(),
    dbUserId
  }));

  const [roomInput, setRoomInput] = useState(roomFromUrl ?? "");
  const [currentActiveRoomID, setCurrentActiveRoomID] = useState<string | null>(roomFromUrl);
  const [makingRoom, setMakingRoom] = useState(false);


  const [sessions, setSessions] = useState<Session[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [platform, setPlatform] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect (() => {
    // if (!userId) return;

    (async () => {
    const res = await fetch(`${BACKEND_URL}/api/profile?userId=${userId}`, {credentials: 'include'})
      if (!res.ok) {
        throw new Error("Something went wrong. Could not load the user profile.");
      }
        const profileInfo: Profile = await res.json()
        setProfile(profileInfo)
      })().catch((error) => {
        console.error(error)

      
    });
}, []);
  useEffect(() => {
    socket.emit("sessions:getAll");

    socket.on("sessions:allSessions", (sessionsArray: Session[]) => {
      setSessions(sessionsArray);
    })
    return () => {
      socket.off("sessions:allSessions");
    }
  }, []);

  useEffect(() => {
    

    fetch(`${BACKEND_URL}/api/playlists?userId=${userId}`, {credentials: 'include'})
      .then((res) => {
        if (!res.ok) throw new Error("Could not load playlists");
        return res.json();
      })
      .then((data) => {
        setPlatform(data.platform);
        setPlaylists(data.playlists);
      })
      .catch(() => {});
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

  async function handleLogout(){

    try{
      const res = await fetch(`${BACKEND_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok){
        throw new Error('Logout failed');
      }

      setProfile(null);
      setPlatform(null);
      setPlaylists([]);

      toast.success("Logged out!");
      navigate('/');
      
      
    }
    catch(err){
      console.error(err);
      toast.error("Couldn't log out! Please try again");

    }

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


  let profileArea;
  if (profile) {
    profileArea = (
      <div className="profile_Area"> 
        
      
        <div className = "info">
          <p>{profile.display_name}</p>
          <p>{profile.email}</p>
          <p>Platform: {profile.platform}</p>
        </div>
          {profile.avatar_url && (
          <>
            <img src={profile.avatar_url} width={72} />
            <div className = "logoutContainer">
              <p onClick = {()=> setMenuOpen((curr)=> !curr)}> &nbsp; {menuOpen ?  (<span style= {{color: "white",fontSize: "22px" }}>▼</span>) : (<span style = {{fontSize: "24px"}} >⚙️</span>) }</p>
              {menuOpen && (<button onClick = {handleLogout} >Logout</button>)}
            </div>
          </>
        )
        }
        
      </div>
    )
  } else {
    profileArea = (
      <>
        <p>Guest</p>
        <p onClick = {handleLogout}> &nbsp; &#9668;</p>
      </>
    )
  }

  return (
    <main className="home-page">
      <div className="top-portion">
      <header className="title-portion">
        <h1>JamSync Live Prototype</h1>
        <p>You are {user.name}</p>
      </header>


       <section className="profile-portion">
                <h2>Profile</h2>
                {profileArea}
                </section>
                </div>
            
                <div className="bottom-portion">
            
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
      <div className="sessions-portion">

             <section>
                <h2>Sessions</h2>
              <div className="session-buttons">

 

     <button onClick={() => setMakingRoom(true)}> Create Session</button>

     
{/* 
      <button onClick={() => setShouldCreateRoom(true)}>
        Create Chat
      </button> */}


      <div className="join-box">
        <input 
                value={roomInput} onChange={(e)=> setRoomInput(e.target.value)}

                placeholder="Enter the Session Code" />
                <button onClick={() => {
                    const trimmedRoomInput = roomInput.trim();
                    if (trimmedRoomInput.length !== 0) {
                    setCurrentActiveRoomID(trimmedRoomInput)}}}>Join Session</button>
      </div>
      </div>
      </section>
      
                  <section className="avail-sess">
                <h2 className = "avail">Available Sessions</h2>
                {sessionsList}
                
            </section>
            </div>
            </div>
    </main>
  );
}