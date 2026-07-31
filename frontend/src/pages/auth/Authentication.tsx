import styles from "./Authentication.module.css";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export default function Authentication() {




    return(
        <>
        <div className = {styles.page}>
            <div className = {styles.header}>
                <h1 className={styles.title}>Welcome to JamSync</h1>
                <h3 className= {styles.subheading}>Select how you would like to login...</h3>
            </div>
            <div className = {styles.cardContainer}>
                <div className = {styles.card}>
                        <h2>Guest</h2>
                        
                        
                            <img src = "https://cdn.creazilla.com/icons/3251108/person-icon-md.png"/>
                    <p>Jump in without connecting an account</p>
                    <a href={`${BACKEND_URL}/auth/guest`}>
                    
                            <button className = {styles.signin}> Continue as a guest </button>
                    </a>
                </div>

            
                    <div className = {styles.card}>
                        <h2>Connect to Spotify</h2>
                        
                        <img src = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/960px-Spotify_icon.svg.png"/>
                        <p>Link your spotify account to get started!</p>
                        <a href={`${BACKEND_URL}/auth/spotify`}>
                            <button className = {styles.spotifyButton}>Connect to Spotify</button>
                        </a>
                    </div>
                    <div className = {styles.card}>
                        <h2>Connect to youtube!</h2>
                        <img src = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1280px-YouTube_full-color_icon_%282017%29.svg.png"/>
                        <p>Link your youtube account to begin!</p>
                        <a href={`${BACKEND_URL}/auth/youtube`}>
                            <button className = {styles.youtubeButton}>Connect to YouTube</button>
                        </a>
                    </div>
            </div>
        </div>
        
        </>
    )
}