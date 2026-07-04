import { describe, expect, it } from "vitest"
import { getTrustedTailscaleUserLogin, isLoopbackIp } from "./authentication.js"

const mockRequest = (headers: Record<string, string | undefined>) => ({
    get: (header: string) => headers[header.toLowerCase()],
})

describe("Tailscale auth helpers", () => {
    it("trusts Tailscale Serve identity headers on localhost requests", () => {
        const req = mockRequest({
            "tailscale-user-login": "danyx23@github",
        })

        expect(getTrustedTailscaleUserLogin(req as any, "127.0.0.1")).toBe(
            "danyx23@github"
        )
    })

    it("ignores spoofed Tailscale identity headers on non-localhost requests", () => {
        const req = mockRequest({
            "tailscale-user-login": "danyx23@github",
        })

        expect(
            getTrustedTailscaleUserLogin(req as any, "100.125.52.18")
        ).toBeUndefined()
    })

    it("recognizes loopback IP variants", () => {
        expect(isLoopbackIp("127.0.0.1")).toBe(true)
        expect(isLoopbackIp("::1")).toBe(true)
        expect(isLoopbackIp("localhost")).toBe(true)
        expect(isLoopbackIp("100.125.52.18")).toBe(false)
    })
})
