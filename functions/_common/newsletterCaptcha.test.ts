import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { JsonError } from "@ourworldindata/utils"
import { validateNewsletterCaptcha } from "./newsletterCaptcha.js"
import { Env } from "./env.js"

const fetchMock = vi.fn()
const env = { TURNSTILE_SECRET_KEY: "secret" } as Env

async function validate(): Promise<JsonError> {
    try {
        await validateNewsletterCaptcha("token", env, "subscribe")
    } catch (error) {
        return error as JsonError
    }
    throw new Error("Expected validation to fail")
}

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe(validateNewsletterCaptcha, () => {
    it.each(["invalid-input-response", "timeout-or-duplicate"])(
        "treats %s as a client error, which is kept out of Sentry",
        async (code) => {
            fetchMock.mockResolvedValue(
                Response.json({ success: false, "error-codes": [code] })
            )
            expect((await validate()).status).toBe(400)
        }
    )

    it.each([
        "missing-input-secret",
        "invalid-input-secret",
        "bad-request",
        "internal-error",
    ])(
        "treats %s as a server error so that Sentry reports it",
        async (code) => {
            fetchMock.mockResolvedValue(
                Response.json({
                    success: false,
                    "error-codes": ["invalid-input-response", code],
                })
            )
            const error = await validate()
            expect(error.status).toBe(503)
            expect(error.message).toContain(code)
        }
    )

    it("keeps the underlying error when siteverify cannot be reached", async () => {
        const networkError = new TypeError("fetch failed")
        fetchMock.mockRejectedValue(networkError)
        const error = await validate()
        expect(error.status).toBe(503)
        expect(error.cause).toBe(networkError)
    })

    it("records the HTTP status when siteverify responds with an error", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 502 }))
        const error = await validate()
        expect(error.status).toBe(503)
        expect((error.cause as Error).message).toContain("502")
    })
})
