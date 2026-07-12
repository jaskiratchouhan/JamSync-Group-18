import dotenv from 'dotenv';
import {Pool} from 'pg';

dotenv.config();
const user = process.env.PGUSER;
const psw = process.env.PGPASSWORD;
const db = process.env.PGDATABASE;
const client_id = process.env.CLIENT_ID;
const pool= new Pool({connectionString: `postgresql://${user}:${psw}@localhost:5432/${db}`});

const helpers = {
    //  init: async()=> {
    //     const q = `CREATE TABLE IF NOT EXISTS users(
    //     id SERIAL PRIMARY KEY,
    //     platform VARCHAR,
    //     email VARCHAR,
    //     platform_id VARCHAR,
    //     display_name VARCHAR, 
    //     avatar_url VARCHAR,
    //     access_token VARCHAR,
    //     refresh_token VARCHAR,
    //     created_at TIMESTAMP DEFAULT NOW(),
    //     token_expires_at TIMESTAMP,
    //     CONSTRAINT uniquePlatFormAccount UNIQUE(platform, platform_id)
    //     );
    //     `;
    //     const q1= `CREATE TABLE IF NOT EXISTS sessions(
    //     id SERIAL PRIMARY KEY,
    //     room_code VARCHAR UNIQUE NOT NULL,
    //     host_user_id INTEGER REFERENCES users(id),
    //     name VARCHAR,
    //     is_public BOOLEAN DEFAULT false,
    //     is_active BOOLEAN DEFAULT true,
    //     created_at TIMESTAMP DEFAULT NOW()
    //     );
    //     `;
    //     const q2 = `CREATE TABLE IF NOT EXISTS session_members(
    //     id SERIAL PRIMARY KEY,
    //     session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    //     user_id INTEGER REFERENCES users(id),
    //     joined_at TIMESTAMP DEFAULT NOW(),
    //     UNIQUE(session_id, user_id)
    //     );
    //     `;

    //     await pool.query(q);
    //     await pool.query(q1);
    //     await pool.query(q2);
    // },

    async insertUser(platform, email, platform_id, display_name, avatar_url, access_token,refresh_token,token_expires_at){
        const q = `INSERT into users(platform, email, platform_id, display_name, avatar_url, access_token,refresh_token,token_expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(platform, platform_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url
        RETURNING*
        `;
        try {
            const result = await pool.query(q,[platform, email, platform_id, display_name, avatar_url, access_token,refresh_token,token_expires_at])
            return result.rows[0];
        }   
        catch(err){
            console.error('insert user failed', err);
        }
    },
    makeRandomName() {
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

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const number = Math.floor(1000 + Math.random() * 9000);

    return `${adjective} ${animal} ${number}`;
    },

    async getUserById(id){
        const q = `SELECT * FROM users WHERE id = $1`;
        const result = await pool.query(q, [id]);
        return result.rows[0];
    },
    // init: async(): Promise<void> => {
    //     const q = `CREATE TABLE IF NOT EXISTS User(
    //     id SERIAL PRIMARY KEY,
    //     name VARCHAR(100), 
    //     platform TEXT NOT NULL,
    //     );
    //     `;

   
    
    async generateUniqueUsername(){
        let username;
        let nameExists = true;
        while (nameExists){
            username = helpers.makeRandomName();
            const q = "SELECT id FROM users WHERE display_name = ($1)";
            const results = await pool.query(q, [username]);
            if (results.rows.length >0){
                nameExists = true;
            }
            else {
                nameExists = false;
            }
        }
        return username;

    },
    async insertBasicUser(){
        const display_name = await helpers.generateUniqueUsername()
        const q = `INSERT INTO users(platform, email, platform_id, display_name, avatar_url, access_token,refresh_token,token_expires_at)
        VALUES (NULL,NULL, NULL, ($1), ($2), NULL, NULL, NULL )
        RETURNING *`;
        const defaultAvator = `https://t4.ftcdn.net/jpg/00/65/77/27/360_F_65772719_A1UV5kLi5nCEWI0BNLLiFaBPEkUbv5Fv.jpg`;
        const result = await pool.query(q, [display_name, defaultAvator]);

        return result.rows[0];
    },

    async insertSession(room_code, host_user_id, name){
        const q = `INSERT into sessions(room_code, host_user_id, name)
        VALUES ($1, $2, $3)
        RETURNING *`
        ;
        const result = await pool.query(q, [room_code, host_user_id, name]);
        return result.rows[0];
    },
    async insertSessionMember(session_id, user_id){
        const q = `INSERT into session_members(session_id, user_id)
        VALUES ($1, $2)
        RETURNING *`;
        const result = await pool.query(q, [session_id, user_id]);
        return result.rows[0];
    },
    async deleteSessionMember(user_id){
        const q = `DELETE FROM session_members WHERE user_id = $1`;
        await pool.query(q, [user_id]);

    },
    async deleteSession(id){
        const q = `DELETE FROM sessions WHERE id= $1`;
        await pool.query(q, [id]);
        
    },
    async getSessionByRoomCode(room_code){
        const q = `SELECT * FROM sessions WHERE room_code = $1`;
        const result = await pool.query(q, [room_code]);
        return result.rows[0];
    },
    // for homescreen when displaying active public sessions
    async getActiveSessions(){
        const q = `SELECT * FROM sessions WHERE is_active = true AND is_public = true`;
        const result = await pool.query(q);
        return result.rows;

    },
    async getSessionsMembers(session_id){
        const q = `SELECT users.id, users.display_name, users.avatar_url, users.platform, session_members.joined_at
        FROM session_members
        JOIN users ON session_members.user_id = users.id
        WHERE session_members.session_id = $1
        `;
        const result = await pool.query(q, [session_id]);
        return result.rows;

    },
    generateRandomString(length){
        const characters= "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = '';

        for (let i =0; i < length; i++){
            const randomIndex = Math.floor(Math.random() *characters.length);
            result += characters.charAt(randomIndex);
        }

        return result;
    }


}

export {helpers};