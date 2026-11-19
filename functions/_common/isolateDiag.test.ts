import { describe, expect, it } from "vitest"
import { isolateDiagMiddleware } from "./isolateDiag.js"

// The middleware only needs the request and next(); the rest of the Pages
// context is irrelevant to it.
function run(headers: Record<string, string> = {}): {
    original: Response
    response: ReturnType<typeof isolateDiagMiddleware>
} {
    const original = new Response("body", {
        status: 201,
        headers: { "content-type": "text/plain" },
    })
    const context = {
        request: new Request("https://example.org/api/x", { headers }),
        next: async () => original,
    } as unknown as Parameters<typeof isolateDiagMiddleware>[0]
    return { original, response: isolateDiagMiddleware(context) }
}

describe(isolateDiagMiddleware, () => {
    it("returns the response untouched when the request doesn't opt in", async () => {
        const { original, response } = run()
        expect(await response).toBe(original)
    })

    it("stamps opted-in responses with the isolate and its running request count", async () => {
        run() // not opted in, but still counted
        const first = await run({ "x-owid-diag": "1" }).response
        const second = await run({ "x-owid-diag": "1" }).response

        const parse = (r: Response): Record<string, string> =>
            Object.fromEntries(
                (r.headers.get("x-owid-diag") ?? "")
                    .split(";")
                    .map((kv) => kv.split("="))
            )
        const a = parse(first)
        const b = parse(second)
        expect(a.iso).toMatch(/^[0-9a-f]{8}$/)
        expect(b.iso).toBe(a.iso)
        expect(Number(b.n)).toBe(Number(a.n) + 1)
        expect(first.status).toBe(201)
        expect(first.headers.get("content-type")).toBe("text/plain")
        expect(await first.text()).toBe("body")
    })
})
