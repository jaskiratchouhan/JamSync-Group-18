// Update with your config settings.
import dotenv from 'dotenv';
dotenv.config();
/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {

  development: {
    client: 'pg',
    connection: process.env.DATABASE_LINK,
    migrations: {
      directory: './migrations'
    }
  },



  production: {
    client: 'pg',
    connection: process.env.DATABASE_LINK,
    
    migrations: {
      directory: './migrations'
    }
  }

};
