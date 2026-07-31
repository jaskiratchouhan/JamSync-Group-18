import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ActiveRoomPage } from "./ActiveRoomPage";
import { makeRandomUser } from "../user";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export default function SessionPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{id: number; display_name: string} | null>(null);
  const [user] = useState(makeRandomUser);
  const [shouldCreateRoom] = useState(roomCode === "new");

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/profile`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Not signed in");
        return res.json();
      })
      .then((profile) => setProfile(profile))
      .catch(() => {
        if (roomCode && roomCode !== "new") {
          sessionStorage.setItem("pendingRoom", roomCode);
        }
        navigate("/");
      });
  }, [navigate, roomCode]);

  if (!profile) {
    return <p className="loading">Loading...</p>;
  }

  return (
    <ActiveRoomPage
      user={{ ...user, dbUserId: profile.id, name: profile.display_name }}
      roomId={shouldCreateRoom ? null : roomCode ?? null}
      shouldCreateRoom={shouldCreateRoom}
    />
  );
}
