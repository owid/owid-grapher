import { describe, it, expect } from "vitest"
import { onRequestGet } from "./index.js"
import type { Env } from "../../_common/env.js"

describe("AI Search API redirect", () => {
    const mockEnv: Env = {} as unknown as Env

    it("redirects /api/ai-search to /api/ai-search/charts", async () => {
        const request = new Request("http://localhost/api/ai-search?q=test")
        const response = await onRequestGet({
            request,
            env: mockEnv,
        } as any)

        expect(response.status).toBe(302)
        expect(response.headers.get("Location")).toBe(
            "http://localhost/api/ai-search/charts?q=test"
        )
    })

    it("preserves all query parameters in redirect", async () => {
        const request = new Request(
            "http://localhost/api/ai-search?q=population&hitsPerPage=10&verbose=true"
        )
        const response = await onRequestGet({
            request,
            env: mockEnv,
        } as any)

        expect(response.status).toBe(302)
        expect(response.headers.get("Location")).toBe(
            "http://localhost/api/ai-search/charts?q=population&hitsPerPage=10&verbose=true"
        )
    })
})
