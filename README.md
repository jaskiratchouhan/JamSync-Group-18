# **CMPT 372 - Group 18 - Project Proposal - JamSync**

---

**The Problem We Are Solving & How It Is Solved Today**

The name of our application is JamSync. When a group of friends wish to listen to music together, there is often a struggle to find the perfect blend of music that appeals to everyone involved. With this application, users will be able to join parties with friends and mix and match music based on an algorithm which combines the playlists of different users into one joined playlist that they can listen to together. Users are able to easily enjoy music with their friends and take on a fun experience of karaoke.

---

**The Target Audience**

The intended audience are music listeners who enjoy discovering new music and listening to music together with a group of people. This application will be helpful because it is very difficult to find music to listen to that a whole group of people would be able to agree on and enjoy. The generation of a playlist that mixes the music taste of everyone in a session reduces the time consuming process of manually picking songs and helps create a list of songs that matches the preference of everyone in the session.

---

**The Scope & Epic Features (4)**

JamSync will have 2 persistent user roles which include a regular user which can experience all feature functionality and an admin which can moderate sessions.

Our first feature is authentication, which will include handling the sign ins, assigning user roles, and storing user information into the database which will be handled by Jaskirat.

Our second big feature is our home screen which includes viewing sessions, joining sessions, creating sessions, viewing profile information, handling different users UI, and handles QR code generation upon session creation in order to allow members to join the session which will be handled by Jaskamal.

Our third big feature, handled by Gurmukh, is our session and communication screen which is the main experience of JamSync. Users can view all session members and interact with playback controls. Music is randomly chosen from the combined playlist contributed by participating users. Queue updates and playback controls are synchronized across all session members. The session owner is able to remove participants.

Our fourth feature is the platform matching algorithm, handled by Amir. This allows users on different platforms to listen to the same songs, by first checking if the song exists in the database. If the song has been processed before, the application retrieves information about supported platforms. If the song has not been seen previously, the application searches across supported platforms and attempts to identify equivalent tracks. Matching decisions are based on attributes such as song length, release date, and artist information. If a reliable match cannot be found, the host receives a warning indicating which users may not be able to listen to the selected song.

---

**High Level Architecture Overview**

For the frontend development we intend to use React which will be used when we are creating the individual pages for the login, home and session. Our project backend development will be fully handled using Express, where the logic for authentication, user roles, database access and the algorithm for matching the songs will be implemented.

Since our project data has clear relationships, PostgreSQL is a good choice for our database with our server running on a Google Cloud VM. Our project needs to use APIs for our playlist functionality to operate. Therefore, for our external services we need Spotify, Apple Music and YouTube APIs, as well as the OAuth login provider through Spotify or Apple Music.

The app will be deployed on a Google Cloud VM. The backend, frontend, and database will run on the same VM for the project version.

---

**The Entities & Key Relationships**

The main entities within the system are User, Session, SessionUser, Playlist, and PlaylistTrack. A User can participate in many Sessions and a Session can contain many Users through the SessionUser relationship. A User can own many Playlists. Each Playlist contains many PlaylistTracks. PlaylistTracks stores metadata including artist name, song name, release date, and song length.

![JamSync ER Diagram](docs/er-diagram.png)

---

**Why this team for this project?**

Our team will work well for this project as we all have previous experience with React and Typescript through the classes we have taken previously. We have chosen to divide the work between the 4 epic features required for the project, each mapped to an individual member that has the skillset best suited for the work.

---

**Framework Justification**

We have decided to go with Stack A so for our frontend we plan to use React which will handle our UI components while our backend will use Express.js.

Creating 2 applications instead of one allows us to keep the frontend and backend separated which is beneficial as our backend handles separate concerns from the frontend and executes its own logic. Keeping them separated means the two sides can be developed and debugged independently by different team members without merge conflicts occurring.

All four members are familiar with React and have prior experience from coursework and personal projects, ensuring development will be smooth and no member will be blocked on the frontend, allowing full attention in developing our features.

Next.js was not selected because the project requires persistent WebSocket connections. JamSync relies heavily on persistent WebSocket connections for real time communication and synchronized playback. A dedicated Express backend provides a simpler and more direct architecture for managing these long running connections.

Additionally, one of the primary advantages of Next.js is server side rendering. Since JamSync operates as a real time application with constantly changing session data, the project would not gain significant benefits from server side rendering. For these reasons, Stack A is a more suitable architecture for the application.

We have gone with a monorepo as this structure improves organization and simplifies collaboration among team members.

The React frontend will communicate with the Express backend through REST API routes and WebSockets. REST will be used for normal actions such as login, sessions, users, and playlist importing. WebSockets will be used for real time session features such as active user updates, chat, call status, and shared media controls.

Nginx will serve the React build and reverse proxy both API and WebSocket traffic to Express on the same VM.

---
