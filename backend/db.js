import dotenv from 'dotenv';
import {Pool} from 'pg';

dotenv.config();
// const user = process.env.PGUSER;
// const psw = process.env.PGPASSWORD;
// const db = process.env.PGDATABASE;
const client_id = process.env.CLIENT_ID;
// const pool: Pool = new Pool({connectionString: `postgresql://${user}:${psw}@localhost:5432/${db}`});

const helpers = {
     init: async()=> {
        const q = `CREATE TABLE IF NOT EXISTS users(
        id SERIAL PRIMARY KEY,
        platform VARCHAR,
        email VARCHAR,
        platform_id VARCHAR,
        display_name VARCHAR, 
        avatar_url VARCHAR,
        access_token VARCHAR,
        refresh_token VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        token_expires_at TIMESTAMP,
        CONSTRAINT uniquePlatFormAccount UNIQUE(platform, platform_id)
        );
        `;

        await pool.query(q);
    },

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
    // init: async(): Promise<void> => {
    //     const q = `CREATE TABLE IF NOT EXISTS User(
    //     id SERIAL PRIMARY KEY,
    //     name VARCHAR(100), 
    //     platform TEXT NOT NULL,
    //     );
    //     `;

    //     await pool.query(q);
    // },

    // generateRandomString(length: number): string{
    //     const characters: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    //     let result : string = '';

    //     for (let i =0; i < length; i++){
    //         const randomIndex = Math.floor(Math.random() *characters.length);
    //         result += characters.charAt(randomIndex);
    //     }

    //     return result;
    // }
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