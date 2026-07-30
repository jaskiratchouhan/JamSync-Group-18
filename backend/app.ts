import express from 'express';
import type {Request, Response} from 'express';
import axios from 'axios';
import {helpers} from './db.ts';
import querystring from 'querystring'
import cors from "cors";
import { Server, Socket} from "socket.io";
import {pool} from "./db.ts";
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import dotenv from 'dotenv';
import {io, onlineUsers} from "./socket.ts";

import swaggerUi from "swagger-ui-express";
import spec from "./swagger.ts";
dotenv.config();

declare module 'express-session' {
  interface SessionData {
    user?: { 
      userId: string; 
       };
  }
}

const app = express();
app.set('trust proxy', 1);
const frontEndUrl = process.env.FRONTEND_URL;
if (!frontEndUrl){
  throw new Error('FrontendURL must be set in .env');
}

app.use(cors({
  origin: frontEndUrl,
  credentials: true // allows credentials like my cookies
}
));

app.use(express.json());

const sessionSecret = process.env.SECRET;
if (!sessionSecret){
  throw new Error('Secret is not set in .env');
}
const pgSession = connectPgSimple(session);

export const sessionSetUp = (session({
  store: new pgSession({
    pool: pool,
    tableName: 'login_sessions',
    createTableIfMissing: true,
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000, // 1 hr
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }

}))
app.use(sessionSetUp);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));




// auth


const client_id = process.env.CLIENT_ID;

const client_secret = process.env.CLIENT_SECRET;


var redirect_uri = (process.env.BACKEND_URL || 'http://127.0.0.1:3001') + '/auth/spotify/callback';

/**
* @openapi
* /auth/spotify:
*   get:
*       summary: takes user to the Spotify login page
*       tags: [Authentication]
*       responses:
*           302:
*               description: takes user to Spotify's OAuth page 
*/


app.get('/auth/spotify', function(req, res) {

  var state = helpers.generateRandomString(16);
  var scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-modify user-top-read streaming user-read-playback-state user-modify-playback-state';

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state,
      show_dialog: true,
    }));
});

/**
 * @openapi
 * /auth/spotify/callback:
 *  get:
 *    summary: Takes care of Spotify callback after authenticating and logs user in Jamsync
 *    tags: [Authentication]
 *    responses:
 *      302: 
 *        description: Takes authenticated user to homepage of app.
 *      500:
 *        description: Authentication did not work.
 */

app.get('/auth/spotify/callback', async function(req, res) {

  var code = req.query.code || null;
  var state = req.query.state || null;

  if (state === null) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  }

    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };
  

  try {
    const tokenResponse = await axios.post(authOptions.url, authOptions.form, {headers: authOptions.headers})
    console.log('Tokens:', tokenResponse.data)
    const {access_token, refresh_token, expires_in} = tokenResponse.data;
    const profileInfo = await axios.get("https://api.spotify.com/v1/me", {headers: {Authorization: `Bearer ${access_token}`}})

    const {account_id, email, display_name, images} = profileInfo.data;

    const avatar_url = images[0]?.url || null;
    const token_expires_at = new Date(Date.now() + expires_in * 1000);

    const user = await helpers.insertUser('spotify', email, account_id, display_name, avatar_url, access_token, refresh_token, token_expires_at)
    console.log('saved user:', user);
    if (!user) {
      console.error("User was unable to save");
      return res.status(500).send("Failed to save user");
    }
    // sets user id into the session object
    req.session.user = {userId: String(user.id)}
    const frontPageUrl = frontEndUrl.replace(/\/+$/, '') + "/homepage?userId=" + user.id
    res.redirect(frontPageUrl);
  }
  catch(err) {
    console.error(err);
    res.status(500).send("Token exchange failed")
  }
});
// auth jam login

/**
 * @openapi
 * /auth/guest:
 *  get: 
 *    summary: Makes a guest user
 *    tags: [Authentication]
 *    responses:
 *      302:
 *        description: Takes guest to homepage
 *      500: 
 *        description: Guest user creation failed.
 */

app.get("/auth/guest", async function(req,res) {
  try{
    const user = await helpers.insertBasicUser();
    req.session.user = {userId: String(user.id)}
    res.redirect(`${frontEndUrl}/guest-welcome?guest_id=${user.id}&guest_name=${encodeURIComponent(user.display_name)}`)
  }
  catch(err){
    console.error(err);
    res.status(500).send("Failed to create guest user");
  }
  
})


var youtube_redirect_uri = (process.env.BACKEND_URL || 'http://127.0.0.1:3001') + '/auth/youtube/callback';

/**
 * @openapi
 * /auth/youtube:
 *  get:
 *    summary: Takes user to Youtube login page
 *    tags: [Authentication]
 *    responses:
 *      302:
 *        description: User is taken to Google's OAuth page.
 */

app.get('/auth/youtube', function(req, res) {

  var state = helpers.generateRandomString(16);
  var scope = 'openid email profile https://www.googleapis.com/auth/youtube.readonly';

  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.GOOGLE_CLIENT_ID,
      scope: scope,
      redirect_uri: youtube_redirect_uri,
      state: state,
      access_type: 'offline',
      prompt: 'consent',
    }));
});

/**
 * @openapi
 * /auth/youtube/callback:
 *  get:
 *    summary: Takes care of Youtube callback after authenticating and logs user in Jamsync
 *    tags: [Authentication]
 *    responses: 
 *      302:
 *        description: Takes authenticated user to the homepage
 *      500: 
 *        description: Could not authenticate.
 */

app.get('/auth/youtube/callback', async function(req, res) {

  var code = req.query.code || null;
  var state = req.query.state || null;

  if (state === null) {
    return res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  }

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code: code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: youtube_redirect_uri,
      grant_type: 'authorization_code'
    }, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    });

    const {access_token, refresh_token, expires_in} = tokenResponse.data;
    const profileInfo = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {headers: {Authorization: `Bearer ${access_token}`}})

    const {id: account_id, email, name: display_name, picture: avatar_url} = profileInfo.data;

    const token_expires_at = new Date(Date.now() + expires_in * 1000);

    const user = await helpers.insertUser('youtube', email, account_id, display_name, avatar_url, access_token, refresh_token, token_expires_at)
    console.log('saved user:', user);
    if (!user) {
      console.error("User was unable to save");
      return res.status(500).send("Failed to save user");
    }
    req.session.user = {userId: String(user.id)}
    const frontPageUrl = frontEndUrl.replace(/\/+$/, '') + "/homepage?userId=" + user.id
    res.redirect(frontPageUrl);
  }
  catch(err) {
    if (axios.isAxiosError(err)){
      const detail = err.response?.data || err.message;
      console.error('YouTube auth error:', detail);
      res.status(500).send("Token exchange failed: " + JSON.stringify(detail));

    }
    else {
      res.status(500).send("Token exchange failed: ");

    }
    
  }
});

/**
 * @openapi
 * /api/profile:
 *  get:
 *    summary: Gets the authenticated user's profile
 *    tags: [User]
 *    responses:
 *      200:
 *        description: Profile was retrieved.
 *      401: 
 *        description: User not authenticated
 *      404: 
 *        description: User was not found
 */

app.get("/api/profile", async function(req,res) {
  if (!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const idOfUser = req.session.user.userId;

  if(!idOfUser) {
    return res.status(400).json({
      error: "User not valid."
    })
  }
    const userId = Number(idOfUser);
    if(Number.isNaN(userId)){
      return res.status(400).json({
      error: "User not valid."
      })
    }
    const user = await helpers.getUserById(userId);

    if (!user) {
      return res.status(404).json({error:"Couldn't find the user."});
    }

    return res.json({
      id: user.id,
      display_name: user.display_name,
      platform: user.platform,
      email: user.email,
      avatar_url: user.avatar_url
      
    });
  
  
})

/**
 * @openapi
 *  /api/playlists:
 *    get:
 *      summary: Get the playlists of the logged in user.
 *      tags: [Music]
 *      responses:
 *        200:
 *          description: Playlists retrieved
 *        400:
 *          description: Invalid user information
 *        401: 
 *          description: The user isn't authenticated
 *      404:
 *        description: Couldn't find the user
 *      500:
 *        description: Could not get the playlists.
 *        
 */
app.get('/api/playlists', async function(req, res) {

   if (!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const userId = req.session.user.userId;
  // const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const userIdN = Number(userId);
    if(Number.isNaN(userIdN)){
      return res.status(400).json({
      error: "User not valid."
      })
    }
    const user = await helpers.getUserById(userIdN);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.platform === 'spotify') {
      const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
        params: { limit: 50 },
        headers: { Authorization: `Bearer ${user.access_token}` }
      });

      const playlists = response.data.items.map((item: any) => ({ id: item.id, name: item.name }));
      return res.json({ platform: 'spotify', playlists });
    }

    if (user.platform === 'youtube') {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
        params: { part: 'snippet', mine: true, maxResults: 50 },
        headers: { Authorization: `Bearer ${user.access_token}` }
      });

      const playlists = response.data.items.map((item: any) => ({ id: item.id, name: item.snippet.title }));
      return res.json({ platform: 'youtube', playlists });
    }

    return res.status(400).json({ error: 'Unsupported platform' });
  } catch (err) {
    if (axios.isAxiosError(err)){
      const detail = err.response?.data || err.message;
      console.error('Playlists error:', detail);

    }
    else {
      console.error('Playlists error:', err);
    }
    
    res.status(500).json({ error: 'Could not fetch playlists' });
  }
});

/**
 * @openapi
 *  /api/top_tracks:
 *    get:
 *      summary: Get the most listened tracks of the user
 *      tags: [Music]
 *      responses: 
 *        200:
 *          description: Most listened to tracks retrieved.
 *        401:
 *          description: Not an authenticated user.
 *        404:
 *          description: Couldn't find the user.
 *        500:
 *          description: Was not successful in retrieving the tracks.
 */

app.get('/api/top_tracks', async function(req,res) {
  if(!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const userId = Number(req.session.user.userId);

  try {
    const user = await helpers.getUserById(userId);

    if (!user) {
      return res.status(404).json({error:"Couldn't find the user."});
    }

    if(user.platform !== "spotify") {
      return res.json([]);
    }

    const response = await axios.get(
      "https://api.spotify.com/v1/me/top/tracks",
      {
        params: {
          limit:4
        },
        headers:{

          Authorization: `Bearer ${user.access_token}`

        }
      }
    )

    const tracks = response.data.items.map((track:any) => ({
      name:track.name,
      artist:track.artists[0].name,
      image: track.album.images[0]?.url
    }))

    return res.json(tracks);


  }
  catch(err) {
    console.error("Couldn't get top tracks:", err)
    return res.status(500).json({
      error:"Couldn't get top tracks."
    })
  }

})

app.get('/api/spotify-token', async function(req,res) {
  if(!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }

  const user = await helpers.getUserById(Number(req.session.user.userId));

  if(!user || user.platform !== "spotify" || !user.access_token){
    return res.status(400).json({error: "No Spotify account connected"});
  }

  return res.json({accessToken: user.access_token});
})

/**
 * @openapi
 *  /friends/request:
 *    post:
 *      summary: Responsible for sending friend requests
 *      tags: [FriendsFeature]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                requestee_id:
 *                  type: integer
 *      responses:
 *        200:
 *          description: Request sent.
 *        400: 
 *          description: Missing required information/bad request.
 *        401:
 *          description: User is not authenticated.
 */

app.post('/friends/request', async function(req,res) {
  if(!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }

  const requester_id = Number(req.session.user.userId);
  const { requestee_id} = req.body;
  if (!requestee_id || requestee_id === requester_id){
    return res.status(400).json({error: "Need to input a display name thats not empty or not your own"});
  }

  const friendReq = await helpers.sendFriendRequest(requester_id, requestee_id);
  const recievingRequestSocketID = onlineUsers.get(requestee_id);
  const senderDetails = await helpers.getUserById(requester_id);
  if (recievingRequestSocketID){
    io.to(recievingRequestSocketID).emit("friend:newRequest", {id: friendReq?.id, requester_id: friendReq?.requester_id, created_at: friendReq?.created_at, display_name: senderDetails.display_name, avatar_url: senderDetails.avatar_url});
  }
  return res.json(friendReq);

  
})

/**
 * @openapi
 * /users/search:
 *  get:
 *    summary: Allows users to search for other users in Jamsync
 *    tags: [FriendsFeature]
 *    parameters:
 *      - in: query
 *        name: name
 *        required: true
 *        schema:
 *          type: string
 * 
 *    responses:
 *      200: 
 *        description: returns users that correspond to the entry
 *      400:
 *        description: Not a valid search request.
 *      401:
 *        description: The person making the request isn't authenticated.
 */
app.get('/users/search', async function(req,res){
  if(!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const query = req.query.name;
  if (!query || typeof query!= 'string'){
    return res.status(400).json({error: "You must enter an input"});
  }
  const results = await helpers.getUserByDisplayName(query);
  return res.json(results);

})

/**
 * @openapi
 * /friends/requests:
 *  get:
 *    summary: Retrieves friend requests that haven't been answered yet.
 *    tags: [FriendsFeature]
 *    responses:
 *      200:
 *        description: Shows the friend requests that still need an answer.
 *      401: 
 *        description: User is not authenticated.
 */

app.get('/friends/requests', async function(req,res){
  if(!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const userId = Number(req.session.user.userId)
  const result = await helpers.grabPendingRequests(userId);
  return res.json(result);
})

/**
 * @openapi
 *  /friends/requests/{id}/accept:
 *  patch:
 *    summary: Responsible for accepting friend requests of user.
 *    tags: [FriendsFeature]
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: integer
 *    responses:
 *      200:
 *        description: The friend request was accepted.
 *      400: 
 *        description: Request could not be accepted.
 *      401: 
 *        description: User not authenticated.
 */
app.patch('/friends/requests/:id/accept', async function(req, res){
  if (!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const id = Number(req.params.id);
  const userId = Number(req.session.user.userId);
  const update = await helpers.updateResponseToRequest(id, userId, 'accepted');
  if (!update){
    return res.status(400).json({error: "Accepting request failed. Request not found"});
  }
  return res.json(update); 
})

/**
 * @openapi
 *  /friends/requests/{id}/decline:
 *  patch:
 *    summary: Responsible for declining friend requests
 *    tags: [FriendsFeature]
 *    parameters:
 *      - in: path
 *        name:id
 *        required: true
 *        schema:
 *          type: integer
 *      
 *    responses:
 *      200:
 *        description: Successfully declined friend request.
 *      400: 
 *        description: Could not decline friend request.
 *      401:
 *        description: The user is not authenticated. 
 *  
 */

app.patch('/friends/requests/:id/decline', async function(req, res){
  if (!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }
  const id = Number(req.params.id);
  const userId = Number(req.session.user.userId);
  const update = await helpers.updateResponseToRequest(id, userId, 'declined');
  if (!update){
    return res.status(400).json({error: "Declining request failed. Request not found"});
  }
  return res.json(update); 
})

/**
 * @openapi
 * /friends/grabAll:
 *  get:
 *    summary: Grabs the friends list
 *    tags: [FriendsFeature]
 *    responses:
 *      200:
 *        description: Successfuly grabbed friends list.
 *      400: 
 *        description: Could not grab friends list.
 *      401:
 *        description: The user is not authenticated.
 */
app.get('/friends/grabAll', async function(req,res) {
  if (!req.session.user){
    return res.status(401).json({error: "Not authenticated"});
  }

  const response = await helpers.getFriends(Number(req.session.user.userId));
  if (!response){
    return res.status(400).json({error: "Failed to grab users friends"});
  }

  const usersWithStatus = response.map((friend: any) => ({...friend, online: onlineUsers.has(friend.friendID)}));
  return res.json(usersWithStatus);
})

/**
 * @openapi
 *  /logout:
 *    post: 
 *      summary: Logs the user out of homepage.
 *      tags: [Authentication]
 *      responses:
 *        200:
 *          description: User was logged out.
 *        500: 
 *          description: User could not log out. 
 */

app.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    return res.json({ ok: true });
  });
});




export default app;