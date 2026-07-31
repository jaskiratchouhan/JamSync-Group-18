
import { useState, useEffect } from "react";
import toast from 'react-hot-toast';

import { io} from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { makeRandomUser } from "./user";
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



const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

const socket = io(BACKEND_URL, {withCredentials: true});

type Playlist = {
  id: string;
  name: string;
};

type CurrentUsersSessions = {
  id: number;
  name: string;
  room_code: string;
  joined_at: string;
}

type UserTopTrack = {
  name: string;
  artist: string;
  image: string | null;
}
export default function HomePage() {
  const navigate = useNavigate();

  const [user] = useState(makeRandomUser);

  const [roomInput, setRoomInput] = useState("");


  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentUsersSessions, setCurrentUsersSessions] = useState<CurrentUsersSessions[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [platform, setPlatform] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [topTracks, setTopTracks] = useState<UserTopTrack[]>([])
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanel] = useState<string | null>(null);
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
    (async () => {
    const res = await fetch(`${BACKEND_URL}/api/profile`, {credentials: 'include'})
      if (!res.ok) {
        throw new Error("Something went wrong. Could not load the user profile.");
      }
        const profileInfo: Profile = await res.json()
        setProfile(profileInfo)
      })().catch((error) => {
        console.error(error)
        navigate('/');


    });
}, [navigate]);
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

  useEffect(()=> {
    function handleNewRequest(newReq: pendingRequest){
      setPendingRequests((prev) => [...prev,newReq]);
    }
    socket.on("friend:newRequest", handleNewRequest);
    return () => {
      socket.off("friend:newRequest", handleNewRequest); 
    }
  }, []);

  


  useEffect(() => {
    

    fetch(`${BACKEND_URL}/api/playlists`, {credentials: 'include'})
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

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/top_tracks`, { credentials: "include"

    })
    .then(res => res.json())
    .then(data => {
      setTopTracks(data);
    })
    .catch(err => {
      console.error("Unable to retrieve top tracks ", err);
    })

  },[])


  useEffect(() => {
    if (!profile) return;

    socket.emit("user:sessions:get", {
      userId: profile.id
    });

    socket.on("user:sessions", (sessions) => {
    setCurrentUsersSessions(sessions);
  });
    return () => {
      socket.off("user:sessions");
    };

  },[profile])

 

 
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
      setAllFriends(data);

    }
    catch(error){
      toast.error(`${error}`);
    }

  }

   


  if (!profile) {
    return <p className="loading">Loading...</p>;
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
        <button onClick={() => navigate(`/session/${session.id}`)}>Join</button>
      </div>
    )
  }
  const currentUserSessionsList = [];
  for (const session of currentUsersSessions) {
    currentUserSessionsList.push(
      <div key={session.id}>
        <p>{session.name}</p>
        <p>Code: {session.room_code}</p>
      </div>
    )
  }


  let profileArea;
  if (profile) {
    profileArea = (
      <>
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
      <div style = {{marginTop: "0.7rem"}}>
        <button style = {{marginRight: "0.8rem"}}onClick = {() => setPanel("requests")}>Friend Requests</button>
        <button onClick = {() => {setPanel("all"); grabFriends()}}>View All Friends</button>
      </div>
      </>
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
        const data = await response.json();
        toast.error(data.error);
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
    const alreadyFriends = allFriends.some((friend) => friend.friendID === requesteeId);
    if (alreadyFriends){
      toast.error("You're already friends");
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/friends/request`,{
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({requestee_id: requesteeId})
        
      });

      
      if (!response.ok){
        const data = await response.json();
        toast.error(data.error);
        return;
      }
      toast.success("Friend request sent!");
      setSearchInput("");
      setSearchResults([]);
    }
    catch(err){
      console.error(err);
      toast.error(`Something went wrong: ${err}`);
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
              <div className = "col-3 friendContainer">
                <div className = "addFriendContainer">
                    <h4 style = {{color: "#eae1d1"}}>Add friends</h4>
                    <div className = "searching" style = {{display: "flex", gap: "6px"}}>
                      <input value = {searchInput} onChange={(e)=> setSearchInput(e.target.value)} placeholder = "Enter display name" />
                      <button onClick ={grabSearchResults}>Search</button>
                    </div>
                      {searchResults.map((res)=>(
                        <>
                        <div key = {res.id} className = "searchRes">
                          <div style = {{display: "flex", alignItems:"center", gap: "8px"}}>
                            {res.avatar_url && <img src = {res.avatar_url} />}
                            <div style = {{display: "flex", flexDirection: "column", width: "100%", flex: 1, lineHeight: 0.3}}>
                              <p style = {{marginLeft: "0.4rem", whiteSpace: "nowrap"}}>{res.display_name} </p>
                              <p style = {{marginLeft: "0.4rem", whiteSpace: "nowrap"}}>from <span style = {{fontWeight: 600, color: "white"}}>{res.platform} </span> </p>
                            </div>
                            
                          </div>
                          
                          <button style = {{marginLeft: "2rem"}}onClick = {() => sendFriendRequest(res.id)}>Send</button>
                          
                        </div>                        
                        </>
                        ))}
                        
                    </div>
                    
              </div>
                
            </div>

              <div className = "friendPanel">
                
                  {panelOpen == "requests" && (   
                      <div className = "pending-requests">
                        <h3>Friend Requests: {pendingRequests.length}</h3>
                        {pendingRequests.map((req)=> (
                          <div key = {req.id} className="requests"> 
                            {req.avatar_url && <img src = {req.avatar_url} />}
                            <p style= {{color: "white"}}>{req.display_name}</p>
                            <button onClick= {()=> respondtoRequest(req.id, "accept")}>Accept</button>
                            <button onClick= {()=> respondtoRequest(req.id, "decline")}>Decline</button>
                          </div>
                        ))}
                      </div>
                      )}

                    {panelOpen == "all" && (
                      <>
                      <p className = "friendsListP" style = {{color: "white"}}>Friends List</p>
                      <div className = " row allFriends">
                        
                      
                        {allFriends.map((friend)=>(
                          <div className = "friendsCard  col-lg-4" key = {friend.friendID}>
                            <p style = {{color: "white"}}>{friend.display_name}</p>
                            <img style = {{width: "50px", height: "50px"}}src = {friend.avatar_url} />
                          </div>
                        ))}
                        </div>
                       </>
                      )}
                      
                </div>
                  {platform === "spotify" && (
                  <section className="toptracks">
                    <h2 style={{color:"white"}}>
                      Tracks You Love
                    </h2>
                    <div className="tracklist">
                      {topTracks.map((track) => (
                        <div className="track-layout" key={track.name}>

                          {track.image && (
                            <img src={track.image} width="100" height="100"></img>
                          )}
                          <p style={{color:"white"}}>
                            {track.name}
                          </p>
                          <p style={{color:"white"}}>
                            {track.artist}
                          </p>
                          </div>
                      ))}
                    </div>
                  </section>
                  )}

            
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

 

     <button onClick={() => navigate("/session/new")}> Create Session</button>

     
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
                    navigate(`/session/${trimmedRoomInput}`)}}}>Join Session</button>
      </div>
      </div>
      </section>

      <section>
        <h2>Joined Sessions</h2>
        {currentUserSessionsList}
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