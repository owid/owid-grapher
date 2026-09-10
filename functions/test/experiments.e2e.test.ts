import { describe, expect, it } from "vitest"
import { setUpTestHarness } from "./setUpTestHarness.js"

const server = setUpTestHarness(
    "./functions/test/wrangler.experiments.e2e.jsonc"
)

const COOKIE = "exp-test-v1"

async function get(path: string, cookie?: string) {
    const response = await server.fetch(
        path,
        cookie ? { headers: { cookie } } : undefined
    )
    const html = await response.text()
    return {
        status: response.status,
        html,
        setCookies: response.headers.getSetCookie(),
        bodyClasses: html.match(/<body class="([^"]*)"/)?.[1].split(" ") ?? [],
    }
}

async function post(path: string, fields: Record<string, string>) {
    const response = await server.fetch(path, {
        method: "POST",
        body: new URLSearchParams(fields).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        redirect: "manual",
    })
    return {
        status: response.status,
        location: response.headers.get("location"),
        setCookies: response.headers.getSetCookie(),
        body: await response.text(),
    }
}

/** The `name=value` a browser would send back for a Set-Cookie header. */
function cookiePair(setCookie: string): string {
    return setCookie.split(";")[0]
}

describe("experiments middleware", () => {
    it("assigns an arm and stamps it on <body> when there is no cookie", async () => {
        const { setCookies, bodyClasses } = await get("/test-page")
        expect(setCookies).toEqual([
            expect.stringContaining(`${COOKIE}=assigned`),
        ])
        expect(bodyClasses).toEqual(["page", `${COOKIE}--assigned`])
    })

    // This is the whole basis of the `/exp` switcher: setting the cookie is
    // enough to force an arm, so nothing in this path needs to know about QA.
    it("honours an existing cookie without reassigning", async () => {
        const { setCookies, bodyClasses } = await get(
            "/test-page",
            `${COOKIE}=forced`
        )
        expect(setCookies).toEqual([])
        expect(bodyClasses).toEqual(["page", `${COOKIE}--forced`])
    })
})

describe("/exp switcher", () => {
    it("lists the active experiments and their arms", async () => {
        const { status, html } = await get("/exp")
        expect(status).toBe(200)
        expect(html).toContain(COOKIE)
        expect(html).toContain('value="assigned"')
        expect(html).toContain('value="forced"')
    })

    it("marks the arm named by the cookie as the current one", async () => {
        const { html } = await get("/exp", `${COOKIE}=forced`)
        expect(html).toContain('value="forced" aria-pressed="true"')
        expect(html).toContain('value="assigned" aria-pressed="false"')
    })

    it("sets the chosen arm's cookie and returns to the page under test", async () => {
        const { status, location, setCookies } = await post("/exp", {
            experiment: COOKIE,
            arm: "forced",
            from: "/test-page",
        })
        expect(status).toBe(303)
        expect(location).toBe("/test-page")
        expect(setCookies).toEqual([
            expect.stringContaining(`${COOKIE}=forced`),
        ])
    })

    // End to end: the cookie the switcher sets is the arm the next page
    // renders, on the very first request and without a client-side swap.
    it("puts the next request in the chosen arm", async () => {
        const { setCookies } = await post("/exp", {
            experiment: COOKIE,
            arm: "forced",
            from: "/test-page",
        })
        const { bodyClasses } = await get(
            "/test-page",
            cookiePair(setCookies[0])
        )
        expect(bodyClasses).toEqual(["page", `${COOKIE}--forced`])
    })

    it("clears the cookie when no arm is chosen, so the next request is reassigned", async () => {
        const { setCookies } = await post("/exp", {
            experiment: COOKIE,
            arm: "",
        })
        expect(setCookies).toEqual([
            expect.stringContaining("Expires=Thu, 01 Jan 1970"),
        ])
    })

    it("clears every experiment cookie on `clear all`", async () => {
        const { status, setCookies } = await post("/exp", {
            action: "clear-all",
        })
        expect(status).toBe(303)
        expect(setCookies).toEqual([
            expect.stringContaining("Expires=Thu, 01 Jan 1970"),
        ])
    })

    it("rejects an unknown arm rather than setting a bogus cookie", async () => {
        const { status, setCookies } = await post("/exp", {
            experiment: COOKIE,
            arm: "bogus",
        })
        expect(status).toBe(400)
        expect(setCookies).toEqual([])
    })

    it("rejects an unknown experiment", async () => {
        const { status } = await post("/exp", {
            experiment: "exp-nope-v1",
            arm: "assigned",
        })
        expect(status).toBe(400)
    })

    it("refuses to redirect off-origin", async () => {
        for (const from of [
            "//evil.example",
            "/\\evil.example",
            "https://evil.example/",
            // A control character would be rejected by `Location` itself,
            // taking the route down with it.
            "/test-page\r\nx-injected: 1",
        ]) {
            const { location } = await post("/exp", {
                experiment: COOKIE,
                arm: "forced",
                from,
            })
            expect(location).toBe("/exp")
        }
    })

    // In production the switcher hands the request to the baked assets
    // untouched: it renders nothing and, crucially, sets no cookie, so a
    // shared link can't force an arm and skew a live experiment.
    it("does not exist in production", async () => {
        const { status, html } = await get("/exp-in-production")
        expect(status).toBe(404)
        expect(html).toBe("baked assets")

        const forced = await post("/exp-in-production", {
            experiment: COOKIE,
            arm: "forced",
        })
        expect(forced.setCookies).toEqual([])
        expect(forced.location).toBeNull()
    })
})
