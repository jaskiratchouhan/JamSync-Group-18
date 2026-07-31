import axios from 'axios';
import querystring from 'querystring';
import dotenv from 'dotenv';
import {helpers} from '../db.ts';
import type {User} from '../db.ts';

dotenv.config();

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;

function isStillValid(user: User) {
  if (!user.access_token) return false;
  if (!user.token_expires_at) return false;
  return new Date(user.token_expires_at).getTime() - Date.now() > 60 * 1000;
}

export async function refreshSpotifyToken(user: User): Promise<string | null> {
  if (!user.refresh_token) return null;

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token
      }),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
        }
      }
    );

    const {access_token, refresh_token, expires_in} = response.data;
    const token_expires_at = new Date(Date.now() + expires_in * 1000);

    await helpers.updateUserTokens(user.id, access_token, refresh_token || user.refresh_token, token_expires_at);

    return access_token;
  }
  catch(err) {
    if (axios.isAxiosError(err)) {
      console.error('Spotify token refresh failed:', err.response?.data || err.message);
    }
    else {
      console.error('Spotify token refresh failed:', err);
    }
    return null;
  }
}

export async function getFreshAccessToken(user: User): Promise<string | null> {
  if (user.platform !== 'spotify') return user.access_token;
  if (isStillValid(user)) return user.access_token;

  return await refreshSpotifyToken(user);
}
