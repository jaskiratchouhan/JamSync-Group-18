import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../app.ts";

describe("Friends", () => {
    it("should return search results for a valid display name", async() => {
        //agent reads incoming cookies and stores them
        const agent = request.agent(app);
        // log into guest to get a valid session cookie, agent sees the cookie in response and stores it
        await agent.get("/auth/guest");
        // agent attaches cookie on request
        const res = await agent.get("/users/search?name=jaskiratc");
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /json/);
        assert.ok(Array.isArray(res.body));
    })
})