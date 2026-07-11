import {useNavigate, useSearchParams} from "react-router-dom";
import styles from "./GuestWelcome.module.css";

export default function GuestWelcome(){
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const guestId = searchParams.get("guest_id");
    const guestName = searchParams.get("guest_name");

    function getStarted(){
        navigate(`/homepage?guest_id=${guestId}&guest_name=${encodeURIComponent(guestName ?? "")}`)
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