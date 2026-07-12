/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export const seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('session_members').del();
  await knex('sessions').del();
  await knex('users').del();
  const users = await knex('users').insert([
   { platform: 'spotify',
    platform_id: 'testing_id_spotify_1',
    email: 'testemail@gmail.com',
    display_name: 'Test Bob',
    avatar_url: null,
    access_token: 'test_token_1',
    refresh_token: 'test_refresh_1',
    token_expires_at: new Date(Date.now() + 3600 *1000)
   },
   {
    platform: null,
    platform_id: null,
    email: null,
    display_name: 'Cosmic Griffin 1234',
    avatar_url: null,
    access_token: null,
    refresh_token: null,
    token_expires_at: null

   }
  ]).returning('id');

  const sessions = await knex('sessions').insert([
    {
      room_code: '1234',
      host_user_id: users[0].id,
      name: 'Test Bobs Room',
      is_public: true,
      is_active: true
    }
  ]).returning('id');

  await knex('session_members').insert([
    {
      session_id: sessions[0].id,
      user_id: users[0].id
    },
    {
      session_id: sessions[0].id,
      user_id: users[1].id

    }
  ])
};
