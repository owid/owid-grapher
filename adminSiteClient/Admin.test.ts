import { afterEach, describe, expect, it, vi } from "vitest"
import { Admin } from "./Admin.js"
// The app shell pulls in antd, which doesn't load under node; requestJSON
// doesn't need it
vi.mock(import("./AdminApp.js"), () => ({}))

function makeAdmin(): Admin {
    return new Admin({
        username: "test",
        email: "test@example.com",
        isSuperuser: false,
        settings: {} as Admin["settings"],
    })
}

function stubFetch(status: number, body: string): void {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(body, { status }))
    )
}

describe("Admin.requestJSON", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("resolves with the body of a successful response", async () => {
        stubFetch(200, JSON.stringify({ datasets: [] }))
        await expect(
            makeAdmin().getJSON("/api/datasets.json")
        ).resolves.toEqual({ datasets: [] })
    })

    // A proxy in front of the admin can answer a 502 with JSON that has no
    // `error` key; resolving with it made the datasets page read
    // `json.datasets` as undefined and crash
    it("rejects a failed response whose JSON body has no error key", async () => {
        stubFetch(502, JSON.stringify({}))
        const admin = makeAdmin()
        await expect(admin.getJSON("/api/datasets.json")).rejects.toMatchObject(
            { status: 502 }
        )
        expect(admin.errorMessage?.title).toContain("(502)")
    })

    it("keeps the server's message when a failed response carries an error", async () => {
        stubFetch(
            400,
            JSON.stringify({
                error: { message: "Invalid request: slug", status: 400 },
            })
        )
        const admin = makeAdmin()
        await expect(admin.getJSON("/api/charts.json")).rejects.toMatchObject({
            message: "Invalid request: slug",
            status: 400,
        })
        expect(admin.errorMessage?.content).toContain("Invalid request: slug")
    })
})
