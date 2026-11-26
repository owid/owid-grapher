import * as Sentry from "@sentry/cloudflare"
import { StatusError } from "itty-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { errorToResponse } from "./errorHandling.js"

vi.mock(import("@sentry/cloudflare"), () => ({ captureException: vi.fn() }))

describe(errorToResponse, () => {
    beforeEach(() => {
        vi.mocked(Sentry.captureException).mockClear()
        vi.spyOn(console, "error").mockImplementation(() => undefined)
    })

    it("answers expected failures with their status, without reporting them", async () => {
        const response = errorToResponse(
            new StatusError(403, "Data download is not allowed")
        )

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({
            status: 403,
            error: "Data download is not allowed",
        })
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it("reports unexpected errors and hides their message", async () => {
        const e = new Error("Missing GRAPHER_CONFIG_R2_BUCKET binding")
        const response = errorToResponse(e)

        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
            status: 500,
            error: "Internal Server Error",
        })
        expect(Sentry.captureException).toHaveBeenCalledWith(e)
    })

    it("reports server-side status errors, keeping their status", () => {
        const e = new StatusError(502, "Upstream failed")
        const response = errorToResponse(e)

        expect(response.status).toBe(502)
        expect(Sentry.captureException).toHaveBeenCalledWith(e)
    })
})
