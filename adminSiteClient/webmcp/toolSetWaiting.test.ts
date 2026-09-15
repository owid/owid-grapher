/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    activeToolSetNames,
    registerToolSet,
    toolSetEpoch,
    waitForToolSet,
    type WebMcpTool,
} from "./webmcpTypes.js"

const tool = (name: string): WebMcpTool => ({
    name,
    description: "x".repeat(50),
    inputSchema: { type: "object", properties: {} },
    execute: async () => "ok",
})

function fakeModelContext(): { registerTool: ReturnType<typeof vi.fn> } {
    const mc = { registerTool: vi.fn().mockResolvedValue(undefined) }
    ;(document as any).modelContext = mc
    return mc
}

describe("tool set registration", () => {
    beforeEach(() => {
        fakeModelContext()
    })

    it("reports a set as active only once its tools are registered", async () => {
        const controller = new AbortController()
        await registerToolSet("page-a", [tool("a")], controller.signal)
        expect(activeToolSetNames()).toContain("page-a")

        controller.abort()
        expect(activeToolSetNames()).not.toContain("page-a")
    })

    it("waits for a set that registers later", async () => {
        const controller = new AbortController()
        const waiting = waitForToolSet("page-b", { timeoutMs: 1000 })
        await registerToolSet("page-b", [tool("b")], controller.signal)
        expect(await waiting).toBe(true)
    })

    it("resolves at once when the set is already registered", async () => {
        const controller = new AbortController()
        await registerToolSet("page-c", [tool("c")], controller.signal)
        expect(await waitForToolSet("page-c", { timeoutMs: 1000 })).toBe(true)
    })

    it("distinguishes a re-registration from the set already there", async () => {
        const first = new AbortController()
        await registerToolSet("page-d", [tool("d")], first.signal)
        const epoch = toolSetEpoch("page-d")

        // The old page's set is still registered, so a plain wait would return
        // immediately; the epoch is what makes this wait for the new page.
        const waiting = waitForToolSet("page-d", {
            afterEpoch: epoch,
            timeoutMs: 1000,
        })
        first.abort()
        const second = new AbortController()
        await registerToolSet("page-d", [tool("d")], second.signal)

        expect(await waiting).toBe(true)
        expect(toolSetEpoch("page-d")).toBeGreaterThan(epoch)
    })

    it("gives up after the timeout rather than hanging the tool call", async () => {
        expect(await waitForToolSet("never", { timeoutMs: 10 })).toBe(false)
    })

    it("does not register or wake waiters when the signal is already aborted", async () => {
        const mc = fakeModelContext()
        const controller = new AbortController()
        controller.abort()
        await registerToolSet("page-e", [tool("e")], controller.signal)
        expect(mc.registerTool).not.toHaveBeenCalled()
        expect(activeToolSetNames()).not.toContain("page-e")
    })
})
