
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



const socket = io("http://127.0.0.1:3001", {withCredentials: true});

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
  const [friendName, setFriendName] = useState("");

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
  type searchResult = {
    id: number;
    display_name: string;
    avatar_url: string | null;
    platform: string | null;

  }

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults]= useState<searchResult[]>([]);
  type friends = {
    friendshipId: number;
    display_name: string;
    avatar_url: string;
    friendID: number ;
    online?: boolean; // optional 
  }
  const [allFriends, setAllFriends] = useState<friends[]>([]);

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

  useEffect(()=> {
    function handleStatusUpdate({userID, online}: {userID: number, online: boolean}){
      console.log("Frontend recieved status update", userID, online);
      setAllFriends((prevFriends) => prevFriends.map((friend)=> 
        friend.friendID === userID ? {...friend, online} : friend
    ));
  };

  socket.on("status:update", handleStatusUpdate);

  return() =>{
    socket.off("status:update", handleStatusUpdate);
  }
        
    
  },[])

  


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

 

 
  type pendingRequest = {
    id: number;
    requester_id: number;
    created_at: string;
    display_name: string;
    avatar_url: string | null;
  }
  const[pendingRequests, setPendingRequests] = useState<pendingRequest[]>([]);
  
   useEffect(() =>{
    async function grabPendingRequests(){
    try{
      const response = await fetch(`${BACKEND_URL}/friends/requests`, {credentials: 'include'});
      if (!response.ok){
        return;
      }
      const data = await response.json();
      setPendingRequests(data);

    }
    catch(err){
      console.error(err);
    }
  }
    grabPendingRequests();
  }, []);

  useEffect(() => {
    grabFriends();
  })
  async function grabFriends(){
    try {
      const response = await fetch(`${BACKEND_URL}/friends/grabAll`, {credentials: "include"});
      if (!response.ok){
        return;
      }
      const data = await response.json();
      console.log("Fetched friends", data);
      setAllFriends(data);

    }
    catch(error){
      toast.error(`${error}`);
    }

  }

   

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

      socket.disconnect();

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

  async function grabSearchResults(){
    try {
      const result = new URLSearchParams({name: searchInput});
      const response = await fetch(`${BACKEND_URL}/users/search?${result}`, {credentials: 'include'});
      if (!response.ok){
        toast.error("Unable to proceed with your request at this time.")
        return;
      }
      const data = await response.json();
      setSearchResults(data);
    }
    catch(error){
      console.error(error);
    }
  }
  

  
  async function sendFriendRequest(requesteeId: number){
    try {
      const response = await fetch(`${BACKEND_URL}/friends/request`,{
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({requestee_id: requesteeId})
        
      });

      
      if (!response.ok){
        toast.error("Something went wrong");
        return;
      }
      toast.success("Friend request sent!");
      setSearchInput("");
      setSearchResults([]);
    }
    catch(err){
      console.error(err);
      toast.error("Something went wrong");
    }

  }

  async function respondtoRequest(id: number, action: string){
    try {
      const response = await fetch(`${BACKEND_URL}/friends/requests/${id}/${action}`, 
        {method: "PATCH", credentials: "include"}
      )
      if (!response.ok){
        toast.error(`Failed to ${action} the request. Please try again later`);
        return;
      }

      setPendingRequests(req => req.filter(r=> r.id !== id));
    }
    catch(error){
      console.log(error);
    }
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

                <div className = "row friends">
                  <div className = " col-9 onlineFriends">
                    <h2>Friends Online</h2>
                    {allFriends.filter((friend)=> friend.online).length === 0 ? (
                      <p style = {{color: "white"}}>No friends online</p>
                    ): (<div className = "onlineFriendsList">
                      {allFriends.filter((friend)=> friend.online == true).map((friend)=> (
                        <div key = {friend.friendID} className = "online-friend">
                          {friend.avatar_url && <img src = {friend.avatar_url}  /> }
                          <p style = {{color: "white"}}>{friend.display_name} 🟢 </p>
                        </div>
                      ))}
                    </div>)}
                  </div>

                <div className = "col-3 addFriendContainer">
                <h3 style = {{color: "#eae1d1"}}>Add friends</h3>
                <input value = {searchInput} onChange={(e)=> setSearchInput(e.target.value)} placeholder = "Enter display name" />
                  <button onClick ={grabSearchResults}>Search</button>
                  {searchResults.map((res)=>(
                    <div key = {res.id} className = "searchRes">
                      {res.avatar_url && <img src = {res.avatar_url} />}
                      <p>{res.display_name} on {res.platform}</p>
                      <button onClick = {() => sendFriendRequest(res.id)}>Send Friend Request</button>
                    </div>
                    ))}
                  </div>
                  </div>
                  
                  
                  <div className = "pending-requests">
                    <h2>Friend Requests {pendingRequests.length}</h2>
                    {pendingRequests.map((req)=> (
                      <div key = {req.id} className="requests"> 
                      {req.avatar_url && <img src = {req.avatar_url} />}
                      <p style= {{color: "white"}}>{req.display_name}</p>
                      <button onClick= {()=> respondtoRequest(req.id, "accept")}>Accept</button>
                      <button onClick= {()=> respondtoRequest(req.id, "decline")}>Decline</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={(grabFriends)}>View Friends List</button>
                  {allFriends.map((friend)=>(
                    <div className = "friendsCard" key = {friend.friendID}>
                    <p style = {{color: "white"}}>{friend.display_name}</p>
                    <img src = {friend.avatar_url} />
                    </div>
                  ))}
                  


            
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