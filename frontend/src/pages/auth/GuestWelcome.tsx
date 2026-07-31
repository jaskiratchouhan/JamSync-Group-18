import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import styles from "./GuestWelcome.module.css";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export default function GuestWelcome(){
    const navigate = useNavigate();
    const [guestName, setGuestName] = useState("");

    useEffect(() => {
        fetch(`${BACKEND_URL}/api/profile`, {credentials: "include"})
            .then((res) => {
                if (!res.ok) throw new Error("Not signed in");
                return res.json();
            })
            .then((profile) => setGuestName(profile.display_name))
            .catch(() => navigate("/"));
    }, []);

    function getStarted(){
        navigate("/homepage")
    }

    return(
        <>
        <div className = {styles.page}>
            <h2 className={styles.title}>Welcome to JamSync!</h2>
            <h2 className = {styles.userText}>You're signed in as </h2>
            <p className = {styles.userName}>{guestName}</p>
            <img src = "https://cdn.creazilla.com/icons/3251108/person-icon-md.png" className={styles.guestImg}/>
            <button className = {styles.getStartedButton} onClick={getStarted}>Get started</button>
        </div>
        </>
    )
}
