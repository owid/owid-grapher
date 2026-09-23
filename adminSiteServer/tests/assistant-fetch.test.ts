import { describe, expect, it } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"

const env = getAdminTestEnv()

async function fetchUrl(url: string): Promise<Response> {
    return fetch(
        `${env.baseUrl}/assistant/fetchUrl?url=${encodeURIComponent(url)}`,
        { headers: { Authorization: `Bearer ${env.apiKey}` } }
    )
}

describe("assistant fetch proxy", { timeout: 20000 }, () => {
    it("refuses private, loopback, and metadata targets", async () => {
        const blocked = [
            "http://localhost:3306/",
            "http://127.0.0.1/latest/meta-data",
            "http://10.1.2.3/",
            "http://192.168.0.1/",
            "http://169.254.169.254/latest/meta-data",
            "http://[::1]/",
            "http://foo.internal/",
        ]
        for (const url of blocked) {
            const response = await fetchUrl(url)
            expect(response.status, url).toBeGreaterThanOrEqual(400)
            const body = await response.json()
            expect(JSON.stringify(body), url).toMatch(
                /private|loopback|link-local/
            )
        }
    })

    it("refuses non-http(s) schemes and invalid URLs", async () => {
        for (const url of ["file:///etc/passwd", "ftp://x.org/a", "nonsense"]) {
            const response = await fetchUrl(url)
            expect(response.status, url).toBeGreaterThanOrEqual(400)
        }
    })

    it("requires authentication", async () => {
        const response = await fetch(
            `${env.baseUrl}/assistant/fetchUrl?url=${encodeURIComponent(
                "https://example.org/"
            )}`
        )
        // unauthenticated /admin/api requests are rejected
        expect(response.status).toBeGreaterThanOrEqual(400)
    })
})
