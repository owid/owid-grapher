import { describe, expect, it } from "vitest"
import {
    getClientIp,
    getTrustedTailscaleUserLogin,
    isLoopbackIp,
    parseForwardedClientIp,
} from "./authentication.js"

const mockRequest = (
    headers: Record<string, string | undefined>,
    remoteAddress = "127.0.0.1"
) => ({
    headers,
    get: (header: string) => headers[header.toLowerCase()],
    socket: { remoteAddress },
})

describe("Tailscale auth helpers", () => {
    it("trusts Tailscale Serve identity headers on localhost requests", () => {
        const req = mockRequest({
            "tailscale-user-login": "danyx23@github",
        })

        expect(getTrustedTailscaleUserLogin(req as any)).toBe("danyx23@github")
    })

    it("ignores spoofed Tailscale identity headers on non-localhost requests", () => {
        const req = mockRequest(
            {
                "tailscale-user-login": "danyx23@github",
            },
            "100.125.52.18"
        )

        expect(getTrustedTailscaleUserLogin(req as any)).toBeUndefined()
    })

    it("recognizes loopback IP variants", () => {
        expect(isLoopbackIp("127.0.0.1")).toBe(true)
        expect(isLoopbackIp("::1")).toBe(true)
        expect(isLoopbackIp("localhost")).toBe(true)
        expect(isLoopbackIp("100.125.52.18")).toBe(false)
        expect(isLoopbackIp(undefined)).toBe(false)
    })

    it("uses the original client IP from X-Forwarded-For", () => {
        const req = mockRequest({
            "x-forwarded-for": "100.125.52.18, 127.0.0.1",
        })

        expect(getClientIp(req as any)).toBe("100.125.52.18")
    })
})

describe("parseForwardedClientIp (shared with the websocket upgrade auth)", () => {
    it("takes the first X-Forwarded-For entry behind proxy chains", () => {
        // tailscale-serve → nginx → node appends each hop
        expect(parseForwardedClientIp("100.64.1.2, 127.0.0.1", "::1")).toBe(
            "100.64.1.2"
        )
        expect(parseForwardedClientIp("100.64.1.2", "127.0.0.1")).toBe(
            "100.64.1.2"
        )
    })

    it("falls back to the socket address without a forwarded header", () => {
        expect(parseForwardedClientIp(undefined, "100.64.1.2")).toBe(
            "100.64.1.2"
        )
        expect(parseForwardedClientIp("", "100.64.1.2")).toBe("100.64.1.2")
    })

    it("strips the IPv4-mapped IPv6 prefix", () => {
        expect(parseForwardedClientIp("::ffff:100.64.1.2, ::1", "::1")).toBe(
            "100.64.1.2"
        )
        expect(parseForwardedClientIp(undefined, "::ffff:100.64.1.2")).toBe(
            "100.64.1.2"
        )
    })

    it("returns undefined when nothing is known", () => {
        expect(parseForwardedClientIp(undefined, undefined)).toBeUndefined()
    })
})
