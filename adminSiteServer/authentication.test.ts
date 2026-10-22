import { describe, expect, it } from "vitest"
import { getClientIp, isLoopbackIp } from "./authentication.js"

const mockRequest = (
    headers: Record<string, string | undefined>,
    remoteAddress = "127.0.0.1"
) => ({
    headers,
    socket: { remoteAddress },
})

describe("Tailscale auth helpers", () => {
    it("recognizes loopback IP variants", () => {
        expect(isLoopbackIp("127.0.0.1")).toBe(true)
        expect(isLoopbackIp("::1")).toBe(true)
        expect(isLoopbackIp("localhost")).toBe(true)
        expect(isLoopbackIp("100.125.52.18")).toBe(false)
        expect(isLoopbackIp(undefined)).toBe(false)
    })

    it("uses the address nginx recorded for a direct request", () => {
        const req = mockRequest({ "x-forwarded-for": "100.125.52.18" })

        expect(getClientIp(req as any)).toBe("100.125.52.18")
    })

    it("uses the address Tailscale Serve recorded when nginx sits behind it", () => {
        const req = mockRequest({
            "x-forwarded-for": "100.125.52.18, 127.0.0.1",
        })

        expect(getClientIp(req as any)).toBe("100.125.52.18")
    })

    it("ignores X-Forwarded-For entries the client sent itself", () => {
        const req = mockRequest({
            "x-forwarded-for": "100.64.0.9, 127.0.0.1, 100.125.52.18",
        })

        expect(getClientIp(req as any)).toBe("100.125.52.18")
    })

    it("falls back to the socket address without X-Forwarded-For", () => {
        const req = mockRequest({}, "::ffff:100.125.52.18")

        expect(getClientIp(req as any)).toBe("100.125.52.18")
    })
})
