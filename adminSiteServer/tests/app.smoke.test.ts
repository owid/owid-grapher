import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"

const env = getAdminTestEnv()

describe("Admin app smoke", { timeout: 10000 }, () => {
    it("starts the app", () => {
        expect(env.app).toBeTruthy()
        expect(env.app.server).toBeTruthy()
    })

    it("returns node version", async () => {
        const res = await fetch("http://localhost:8765/admin/nodeVersion", {
            headers: { cookie: `sessionid=${env.cookieId}` },
        })
        expect(res.status).toBe(200)
        const text = await res.text()
        expect(text).toBe(process.version)
    })

    it("creates a GDoc article via API", async () => {
        const gdocId = "gdoc-test-create-1"
        const response = await env.request({
            method: "PUT",
            path: `/gdocs/${gdocId}`,
        })
        expect(response.id).toBe(gdocId)

        const gdoc = await env.fetchJson(`/gdocs/${gdocId}`)
        expect(gdoc.id).toBe(gdocId)
        expect(gdoc.content.title).toBe("Basic article")
    })
})
