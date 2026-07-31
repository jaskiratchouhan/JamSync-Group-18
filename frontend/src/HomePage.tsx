
import { useState, useEffect } from "react";
import toast from 'react-hot-toast';

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



const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

const socket = io(BACKEND_URL, {withCredentials: true});

type Playlist = {
  id: string;
  name: string;
};

type UserTopTrack = {
  name: string;
  artist: string;
  image: string | null;
}

type CurrentUsersSessions = {
  id: number;
  name: string;
  room_code: string;
  joined_at: string;
}
export default function HomePage() {
  const navigate = useNavigate();


  const [roomInput, setRoomInput] = useState("");


  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentUsersSessions, setCurrentUsersSessions] = useState<CurrentUsersSessions[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [platform, setPlatform] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [topTracks, setTopTracks] = useState<UserTopTrack[]>([])
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

        const pendingRoom = sessionStorage.getItem("pendingRoom");
        if (pendingRoom){
          sessionStorage.removeItem("pendingRoom");
          navigate(`/session/${pendingRoom}`);
        }
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

  useEffect(() => {
    if (!profile) return;

    socket.emit("user:sessions:get", { userId: profile.id });

    socket.on("user:sessions", (sessions) => {
      setCurrentUsersSessions(sessions);
    });

    return () => {
      socket.off("user:sessions");
    };
  }, [profile]);

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
      <div key={session.id} className="list-row">
        <div>
          <p>Session {session.id}</p>
          <p className="meta">{session.users.map((user) => user.name).join(", ") || "Empty"}</p>
        </div>
        <button onClick={() => navigate(`/session/${session.id}`)}>Join</button>
      </div>
    )
  }

  const currentUserSessionsList = [];
  for (const session of currentUsersSessions) {
    currentUserSessionsList.push(
      <div key={session.id} className="list-row">
        <div>
          <p>{session.name}</p>
          <p className="meta">Code: {session.room_code}</p>
        </div>
      </div>
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
      <header className="home-header">
        <div>
          <h1>JamSync</h1>
          <p className="tagline">Listen together</p>
        </div>

        <div className="profile-chip">
          {profile.avatar_url && <img src={profile.avatar_url} />}

          <div>
            <p className="name">{profile.display_name}</p>
            <p className="platform">{profile.platform ?? "Guest"}</p>
          </div>

          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="home-content">
        <div className="column">
          <section className="panel">
            <h2>Sessions</h2>

            <div className="session-actions">
              <button className="primary" onClick={() => navigate("/session/new")}>
                Create a session
              </button>

              <div className="join-box">
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="Enter a session code"
                />
                <button
                  onClick={() => {
                    const trimmedRoomInput = roomInput.trim();
                    if (trimmedRoomInput.length !== 0) {
                      navigate(`/session/${trimmedRoomInput}`);
                    }
                  }}
                >
                  Join
                </button>
              </div>
            </div>

            <h3>Recent sessions</h3>
            {currentUserSessionsList.length === 0 ? (
              <p className="empty">You have not joined a session yet.</p>
            ) : (
              <div className="list">{currentUserSessionsList}</div>
            )}

            <h3>Available now</h3>
            {sessionsList.length === 0 ? (
              <p className="empty">No public sessions right now.</p>
            ) : (
              <div className="list">{sessionsList}</div>
            )}
          </section>

          {platform === "spotify" && topTracks.length > 0 && (
            <section className="panel">
              <h2>Tracks you love</h2>

              <div className="tracklist">
                {topTracks.map((track) => (
                  <div className="track-layout" key={track.name}>
                    {track.image && <img src={track.image} />}
                    <p>{track.name}</p>
                    <p className="meta">{track.artist}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="column">
          <section className="panel">
            <h2>Friends</h2>

            <div className="search-box">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by display name"
              />
              <button onClick={grabSearchResults}>Search</button>
            </div>

            {searchResults.length > 0 && (
              <div className="list">
                {searchResults.map((res) => (
                  <div key={res.id} className="list-row">
                    <div className="person">
                      {res.avatar_url && <img src={res.avatar_url} />}
                      <div>
                        <p>{res.display_name}</p>
                        <p className="meta">{res.platform ?? "Guest"}</p>
                      </div>
                    </div>
                    <button onClick={() => sendFriendRequest(res.id)}>Add</button>
                  </div>
                ))}
              </div>
            )}

            <h3>Online</h3>
            {allFriends.filter((friend) => friend.online).length === 0 ? (
              <p className="empty">No friends online.</p>
            ) : (
              <div className="online-friends">
                {allFriends
                  .filter((friend) => friend.online)
                  .map((friend) => (
                    <div key={friend.friendID} className="online-friend">
                      {friend.avatar_url && <img src={friend.avatar_url} />}
                      <span>{friend.display_name}</span>
                    </div>
                  ))}
              </div>
            )}

            <h3>Requests and friends</h3>
            <div className="tabs">
              <button onClick={() => setPanel("requests")}>
                Requests ({pendingRequests.length})
              </button>
              <button onClick={() => { setPanel("all"); grabFriends(); }}>
                All friends
              </button>
            </div>

            {panelOpen === "requests" && (
              pendingRequests.length === 0 ? (
                <p className="empty">No pending requests.</p>
              ) : (
                <div className="list">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="list-row">
                      <div className="person">
                        {req.avatar_url && <img src={req.avatar_url} />}
                        <p>{req.display_name}</p>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => respondtoRequest(req.id, "accept")}>Accept</button>
                        <button onClick={() => respondtoRequest(req.id, "decline")}>Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {panelOpen === "all" && (
              allFriends.length === 0 ? (
                <p className="empty">No friends yet.</p>
              ) : (
                <div className="list">
                  {allFriends.map((friend) => (
                    <div key={friend.friendID} className="list-row">
                      <div className="person">
                        {friend.avatar_url && <img src={friend.avatar_url} />}
                        <p>{friend.display_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </section>

          {platform && (
            <section className="panel">
              <h2>Your {platform} playlists</h2>

              {playlists.length === 0 ? (
                <p className="empty">No playlists found.</p>
              ) : (
                <ul className="playlist-list">
                  {playlists.map((playlist) => (
                    <li key={playlist.id}>{playlist.name}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}