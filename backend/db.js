import dotenv from 'dotenv';
import {Pool} from 'pg';

dotenv.config();
// const user = process.env.PGUSER;
// const psw = process.env.PGPASSWORD;
// const db = process.env.PGDATABASE;
const client_id = process.env.CLIENT_ID;
// const pool: Pool = new Pool({connectionString: `postgresql://${user}:${psw}@localhost:5432/${db}`});

const helpers = {
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