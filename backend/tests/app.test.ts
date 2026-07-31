import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../app.ts";
import { helpers } from "../db.ts";
import { create } from "node:domain";

const createdUserIds: number[] = [];
const createdFriendRequests: number[] = [];
// many of our routes require authentication so func to createguest user to proceed
async function createGuestSession(){
    //agent reads incoming cookies and stores them
    const agent = request.agent(app);
    // log into guest to get a valid session cookie, agent sees the cookie in response and stores it
    await agent.get("/auth/guest");
    // create guest user inserted in db and grabs user info
    const guestInfo = await agent.get("/api/profile");
    assert.equal(guestInfo.status, 200);
    const userId = guestInfo.body.id;
    createdUserIds.push(userId);
    return {agent, userId};

}

describe("oAuth", ()=> {
    it("adds a guest user to the array after authentication", async()=>{
        const guestUser = createGuestSession();
        const dbUser = await helpers.getUserById((await guestUser).userId);
        assert.ok(dbUser, "user should exist");
        assert.equal(dbUser.platform,null);
    })

})

describe("Unauthenticated access is blocked", ()=>{
    it("should reject /friends/grabAll with no session", async()=>{
        const res = await request(app).get("/friends/grabAll");
        assert.equal(res.status, 401);
        assert.ok(res.body.error);
    })

    it("should reject /friends/requests with no session", async()=>{
        const res = await request(app).get("/friends/requests");
        assert.equal(res.status, 401);
        assert.ok(res.body.error);
    })

    it("should reject a POST to /friends/request with no session", async()=>{
        const res = await request(app)
            .post("/friends/request")
            .send({requestee_id: 1});
        assert.equal(res.status, 401);
        assert.ok(res.body.error);
    })

    
})
describe("Friends", () => {

    let requester: {agent: any, userId: number}
    let requestee : {agent: any, userId: number}
    let friendRequestId: number;

    it("sends a valid friend request", async()=> {
         requester = await createGuestSession();
         requestee = await createGuestSession();

        const res = await requester.agent
            .post("/friends/request")
            .send({requestee_id: requestee.userId})
        assert.equal(res.status, 200);
        assert.equal(res.body.requester_id, requester.userId)
        assert.equal(res.body.requestee_id, requestee.userId)
        assert.equal(res.body.status, "pending");
        friendRequestId = res.body.id
        createdFriendRequests.push(friendRequestId);
    })

    it("should reject a request sent to your own user", async() => {
        const requester = await createGuestSession();
        const response = await requester.agent
            .post("/friends/request")
            .send({requestee_id: requester.userId});
        assert.equal(response.status, 400);
      
    });

    it("should grab the pending friend request", async()=>{
        const response = await requestee.agent
            .get("/friends/requests")
        assert.equal(response.status, 200);
    })

    it("should accept a request recieved", async() => {
        const response = await requestee.agent.patch(`/friends/requests/${friendRequestId}/accept`);
        assert.equal(response.status, 200);
        assert.equal(response.body.status, "accepted");
    })

     it("should grab all existing friends", async() => {
        const response = await requestee.agent.get("/friends/grabAll");
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(response.body));
        const friend = response.body.find((f: any) => f.friendID === requester.userId);
        assert.ok(friend, "requester should be in friends list")
    })

})

describe("Profile", () => {
    it("should return the profile of the user", async() => {
        const {agent, userId} = await createGuestSession();
        const response = await agent.get("/api/profile")
        assert.equal(response.status, 200);
        assert.equal(response.body.id, userId)
        assert.ok(response.body.display_name)
    })

    it("should reject trying to obtain profile information if not authenticated", async() => {
        const response = await request(app).get("/api/profile")
        assert.equal(response.status, 401);
        assert.ok(response.body.error)
    })
})


describe("Track Recommendations", () => {
    it("should not accept a request for grabbing track suggestions for user that isn't authenticated", async() => {
        const response = await request(app).get("/api/top_tracks");
        assert.equal(response.status,401);
    })
    it("should not return anything for a user that isn't a Spotify user", async() => {
        const {agent} = await createGuestSession()
        const response = await agent.get("/api/top_tracks")
        assert.equal(response.status, 200)
        assert.deepEqual(response.body,[])
    });
   
})

describe("Joined Sessions", () => {
    it("should not work if no user is logged in", async() => {
        const response = await request(app).get("/api/recent_sessions")
        assert.equal(response.status, 401)
    })
    it("if there are no joined sessions, return nothing", async() => {
        const {agent} = await createGuestSession()
        const response = await agent.get("/api/recent_sessions")
        assert.equal(response.status, 200)
        assert.deepEqual(response.body, [])
    })
    it("returns the joined sessions of the current user", async() => {
        const {agent, userId} = await createGuestSession()
        const session = await helpers.insertSession(Date.now().toString(), userId, "Mock")
        await helpers.insertSessionMember(session.id, userId)

        const response = await agent.get("/api/recent_sessions")

        assert.equal(response.status, 200)
        assert.equal(response.body.length, 1)
        assert.equal(response.body[0].id, session.id)
        await helpers.deleteSession(session.id);
    })

})

describe("Unit tests for generateRandomString", () => {
    it("returns different values across seperate calls", () =>{
        const firstName = helpers.generateRandomString(16);
        const secondName = helpers.generateRandomString(16);
        assert.notEqual(firstName, secondName);
    })
    it("returns a string of the requested length", () =>{
        const result = helpers.generateRandomString(16);
        assert.equal(result.length, 16);
    })
})

describe("Unit tests for helpers.makeRandomName", ()=> {
    it("returns a string", () => {
        const result = helpers.makeRandomName();
        assert.equal(typeof result, "string");
    })
})

after(async() => {
        for (const id of createdFriendRequests){
            await helpers.deleteFriendRequest(id);
        }

        for (const id of createdUserIds){
            await helpers.deleteUser(id);
        }
    })