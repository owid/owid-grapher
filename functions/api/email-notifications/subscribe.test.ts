import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onRequestPost } from "./subscribe.js"
import { upsertOwidBriefSubscription } from "../../_common/mailchimp.js"

vi.mock(import("../../_common/mailchimp.js"), () => ({
    upsertOwidBriefSubscription: vi.fn(),
}))

const fetchMock = vi.fn()
const prepare = vi.fn()

async function submit(payload: Record<string, unknown>, secret = "secret") {
    return onRequestPost({
        request: new Request(
            "https://ourworldindata.org/api/email-notifications/subscribe",
            {
                method: "POST",
                body: JSON.stringify({
                    email: "reader@example.com",
                    subscribeToOwidBrief: true,
                    ...payload,
                }),
            }
        ),
        env: {
            TURNSTILE_SECRET_KEY: secret,
            EMAIL_NOTIFICATIONS_DB: { prepare },
        },
    } as unknown as Parameters<typeof onRequestPost>[0])
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockResolvedValue(
        Response.json({ success: true, action: "subscribe" })
    )
    prepare.mockReturnValue({
        bind: () => ({
            run: vi.fn(),
            first: () => ({
                id: 1,
                email: "reader@example.com",
                token: "identity",
            }),
        }),
    })
})

afterEach(() => vi.unstubAllGlobals())

describe("subscribe spam protection", () => {
    it.each([undefined, "", "x".repeat(2049)])(
        "rejects missing, empty and oversized tokens",
        async (captchaToken) => {
            expect((await submit({ captchaToken })).status).toBe(400)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(prepare).not.toHaveBeenCalled()
        }
    )

    it("silently discards the honeypot without contacting providers or the database", async () => {
        const response = await submit({
            captchaToken: "token",
            website: "spam",
        })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(fetchMock).not.toHaveBeenCalled()
        expect(prepare).not.toHaveBeenCalled()
        expect(upsertOwidBriefSubscription).not.toHaveBeenCalled()
    })

    it.each([
        { success: false, "error-codes": ["timeout-or-duplicate"] },
        { success: true, action: "donate" },
        { success: true },
        { success: "true", action: "subscribe" },
    ])(
        "rejects unsuccessful or incorrectly scoped verification: %j",
        async (result) => {
            fetchMock.mockResolvedValue(Response.json(result))
            expect((await submit({ captchaToken: "token" })).status).toBe(400)
            expect(prepare).not.toHaveBeenCalled()
            expect(upsertOwidBriefSubscription).not.toHaveBeenCalled()
        }
    )

    it("fails closed if verification is unavailable", async () => {
        fetchMock.mockRejectedValue(new Error("Network unavailable"))
        expect((await submit({ captchaToken: "token" })).status).toBe(503)
        expect(prepare).not.toHaveBeenCalled()
    })

    it("fails closed without a secret", async () => {
        expect((await submit({ captchaToken: "token" }, "")).status).toBe(503)
        expect(fetchMock).not.toHaveBeenCalled()
        expect(prepare).not.toHaveBeenCalled()
    })

    it("subscribes only after successful verification", async () => {
        expect(
            (await submit({ captchaToken: "token", website: "" })).status
        ).toBe(200)
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            secret: "secret",
            response: "token",
        })
        expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
            prepare.mock.invocationCallOrder[0]
        )
        expect(upsertOwidBriefSubscription).toHaveBeenCalledWith(
            expect.anything(),
            "reader@example.com",
            true
        )
    })

    it.each([
        { success: true, action: "test" },
        {
            success: true,
            hostname: "example.com",
            "error-codes": [],
            metadata: { result_with_testing_key: true },
        },
    ])(
        "accepts dummy responses only with Cloudflare's test secret: %j",
        async (result) => {
            fetchMock.mockImplementation(async () => Response.json(result))
            expect(
                (await submit({ captchaToken: "XXXX.DUMMY.TOKEN.XXXX" })).status
            ).toBe(400)
            expect(prepare).not.toHaveBeenCalled()
            expect(
                (
                    await submit(
                        { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" },
                        "1x0000000000000000000000000000000AA"
                    )
                ).status
            ).toBe(200)
        }
    )

    it("still rejects failed verification with the test secret", async () => {
        fetchMock.mockResolvedValue(Response.json({ success: false }))
        expect(
            (
                await submit(
                    { captchaToken: "token" },
                    "1x0000000000000000000000000000000AA"
                )
            ).status
        ).toBe(400)
        expect(prepare).not.toHaveBeenCalled()
    })
})
