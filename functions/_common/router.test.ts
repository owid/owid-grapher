import * as Sentry from "@sentry/cloudflare"
import { StatusError } from "itty-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createRouter } from "./router.js"

vi.mock(import("@sentry/cloudflare"), () => ({ captureException: vi.fn() }))

describe(createRouter, () => {
    const router = createRouter<[]>()
        .get("/ok", () => new Response("ok"))
        .get("/forbidden", () => {
            throw new StatusError(403, "Data download is not allowed")
        })
        .get("/broken", () => {
            throw new Error("Missing binding")
        })

    const fetch = (path: string): Promise<Response> =>
        router.fetch(
            new Request(`https://ourworldindata.org${path}`, {
                headers: { Origin: "https://example.com" },
            })
        )

    beforeEach(() => {
        vi.mocked(Sentry.captureException).mockClear()
        vi.spyOn(console, "error").mockImplementation(() => undefined)
    })

    it("adds CORS headers to successful responses", async () => {
        const response = await fetch("/ok")

        expect(response.status).toBe(200)
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    })

    // Without CORS headers, cross-origin clients can't read the error at all
    it("adds CORS headers to expected failures, without reporting them", async () => {
        const response = await fetch("/forbidden")

        expect(response.status).toBe(403)
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it("reports unexpected errors and still adds CORS headers", async () => {
        const response = await fetch("/broken")

        expect(response.status).toBe(500)
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
        expect(Sentry.captureException).toHaveBeenCalledOnce()
    })
})
