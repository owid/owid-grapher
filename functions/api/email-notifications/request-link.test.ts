import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onRequestPost } from "./request-link.js"
import {
    createEmailToken,
    sendMagicLinkEmail,
} from "../../_common/emailNotifications.js"

vi.mock(
    import("../../_common/emailNotifications.js"),
    async (importOriginal) => ({
        ...(await importOriginal()),
        createEmailToken: vi.fn().mockResolvedValue("magic-token"),
        sendMagicLinkEmail: vi.fn(),
    })
)

const fetchMock = vi.fn()
const first = vi.fn()
const prepare = vi.fn(() => ({ bind: () => ({ first }) }))

async function submit(payload: Record<string, unknown>, isJson = true) {
    return onRequestPost({
        request: new Request(
            "https://ourworldindata.org/api/email-notifications/request-link",
            {
                method: "POST",
                headers: {
                    "Content-Type": isJson
                        ? "application/json"
                        : "application/x-www-form-urlencoded",
                },
                body: isJson
                    ? JSON.stringify(payload)
                    : new URLSearchParams(payload as Record<string, string>),
            }
        ),
        env: {
            TURNSTILE_SECRET_KEY: "secret",
            EMAIL_NOTIFICATIONS_DB: { prepare },
        },
    } as unknown as Parameters<typeof onRequestPost>[0])
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation(async () =>
        Response.json({ success: true, action: "request-link" })
    )
    first.mockResolvedValue({ id: 1, email: "reader@example.com" })
})

afterEach(() => vi.unstubAllGlobals())

describe("request-link spam protection", () => {
    it.each([undefined, "", "x".repeat(2049)])(
        "rejects missing, empty and oversized verification tokens",
        async (captchaToken) => {
            expect(
                (await submit({ email: "reader@example.com", captchaToken }))
                    .status
            ).toBe(400)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(prepare).not.toHaveBeenCalled()
            expect(sendMagicLinkEmail).not.toHaveBeenCalled()
        }
    )

    it.each([
        { success: false },
        { success: true, action: "subscribe" },
        { success: true },
    ])(
        "rejects failed or incorrectly scoped verification before looking up the address: %j",
        async (result) => {
            fetchMock.mockResolvedValue(Response.json(result))
            expect(
                (
                    await submit({
                        email: "reader@example.com",
                        captchaToken: "captcha",
                    })
                ).status
            ).toBe(400)
            expect(prepare).not.toHaveBeenCalled()
            expect(sendMagicLinkEmail).not.toHaveBeenCalled()
        }
    )

    it("fails closed when verification is unavailable", async () => {
        fetchMock.mockRejectedValue(new Error("Network unavailable"))
        expect(
            (
                await submit({
                    email: "reader@example.com",
                    captchaToken: "captcha",
                })
            ).status
        ).toBe(503)
        expect(prepare).not.toHaveBeenCalled()
        expect(sendMagicLinkEmail).not.toHaveBeenCalled()
    })

    it("silently discards honeypot submissions", async () => {
        const response = await submit({
            email: "reader@example.com",
            captchaToken: "captcha",
            website: "spam",
        })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(fetchMock).not.toHaveBeenCalled()
        expect(prepare).not.toHaveBeenCalled()
        expect(sendMagicLinkEmail).not.toHaveBeenCalled()
    })

    it("verifies before looking up the address and sending a link", async () => {
        const response = await submit({
            email: "reader@example.com",
            captchaToken: "captcha",
            website: "",
        })
        expect(response.status).toBe(200)
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            secret: "secret",
            response: "captcha",
        })
        expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
            prepare.mock.invocationCallOrder[0]
        )
        expect(createEmailToken).toHaveBeenCalled()
        expect(sendMagicLinkEmail).toHaveBeenCalledWith(
            expect.anything(),
            "https://ourworldindata.org",
            { userId: 1, to: "reader@example.com", token: "magic-token" }
        )
    })

    it("returns the same success for unknown addresses after verification, without sending mail", async () => {
        first.mockResolvedValue(null)
        const response = await submit({
            email: "unknown@example.com",
            captchaToken: "captcha",
        })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(createEmailToken).not.toHaveBeenCalled()
        expect(sendMagicLinkEmail).not.toHaveBeenCalled()
    })

    it.each([true, false])(
        "preserves token-based requests without a challenge (JSON: %s)",
        async (isJson) => {
            expect(
                (await submit({ token: "existing-email-token" }, isJson)).status
            ).toBe(200)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(sendMagicLinkEmail).toHaveBeenCalledOnce()
        }
    )

    it("does not allow a token field to bypass verification for an email address", async () => {
        expect(
            (
                await submit({
                    email: "reader@example.com",
                    token: "existing-token",
                })
            ).status
        ).toBe(400)
        expect(prepare).not.toHaveBeenCalled()
        expect(sendMagicLinkEmail).not.toHaveBeenCalled()
    })

    it("does not accept unverified email addresses through form posts", async () => {
        expect(
            (await submit({ email: "reader@example.com" }, false)).status
        ).toBe(404)
        expect(prepare).not.toHaveBeenCalled()
        expect(sendMagicLinkEmail).not.toHaveBeenCalled()
    })
})
