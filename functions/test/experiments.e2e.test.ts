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
        setCookies: response.headers.getSetCookie(),
        bodyClasses: html.match(/<body class="([^"]*)"/)?.[1].split(" ") ?? [],
    }
}

describe("experiments middleware", () => {
    it("assigns an arm and stamps it on <body> when there is no cookie", async () => {
        const { setCookies, bodyClasses } = await get("/test-page")
        expect(setCookies).toEqual([
            expect.stringContaining(`${COOKIE}=assigned`),
        ])
        expect(bodyClasses).toEqual(["page", `${COOKIE}--assigned`])
    })

    it("honours an existing cookie without reassigning", async () => {
        const { setCookies, bodyClasses } = await get(
            "/test-page",
            `${COOKIE}=forced`
        )
        expect(setCookies).toEqual([])
        expect(bodyClasses).toEqual(["page", `${COOKIE}--forced`])
    })

    it("lets `?exp-<id>=<arm>` force an arm on the very first request", async () => {
        const { setCookies, bodyClasses } = await get(
            "/test-page?exp-test-v1=forced"
        )
        expect(setCookies).toEqual([
            expect.stringContaining(`${COOKIE}=forced`),
        ])
        expect(bodyClasses).toEqual(["page", `${COOKIE}--forced`])
    })

    it("lets the parameter beat a conflicting cookie", async () => {
        const { setCookies, bodyClasses } = await get(
            "/test-page?exp-test-v1=forced",
            `${COOKIE}=assigned`
        )
        expect(setCookies).toEqual([
            expect.stringContaining(`${COOKIE}=forced`),
        ])
        expect(bodyClasses).toEqual(["page", `${COOKIE}--forced`])
    })

    it("ignores an unknown arm, falling back to the cookie", async () => {
        const { setCookies, bodyClasses } = await get(
            "/test-page?exp-test-v1=bogus",
            `${COOKIE}=forced`
        )
        expect(setCookies).toEqual([])
        expect(bodyClasses).toEqual(["page", `${COOKIE}--forced`])
    })

    it("sets the cookie for an override off the experiment's paths, without a body class", async () => {
        const { setCookies, bodyClasses } = await get(
            "/elsewhere?exp-test-v1=forced"
        )
        expect(setCookies).toEqual([
            expect.stringContaining(`${COOKIE}=forced`),
        ])
        expect(bodyClasses).toEqual(["page"])
    })
})
