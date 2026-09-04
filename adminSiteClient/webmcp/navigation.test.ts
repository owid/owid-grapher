/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import type { History } from "history"
import {
    isValidAdminPath,
    navigateTo,
    navigationBlockedReason,
    registerNavigationGuard,
    setAdminHistory,
} from "./navigation.js"

function fakeHistory(): History & { push: ReturnType<typeof vi.fn> } {
    return {
        push: vi.fn(),
        replace: vi.fn(),
    } as unknown as History & { push: ReturnType<typeof vi.fn> }
}

afterEach(() => setAdminHistory(undefined))

describe(isValidAdminPath, () => {
    it("accepts admin-relative paths", () => {
        expect(isValidAdminPath("/charts")).toBe(true)
        expect(isValidAdminPath("/charts/123/edit")).toBe(true)
        expect(isValidAdminPath("/variables/1")).toBe(true)
    })

    it("refuses URLs, files and paths carrying a query", () => {
        expect(isValidAdminPath("https://example.org/")).toBe(false)
        expect(isValidAdminPath("//evil.example")).toBe(false)
        expect(isValidAdminPath("/charts/1.config.json")).toBe(false)
        expect(isValidAdminPath("/charts?chartSearch=x")).toBe(false)
        expect(isValidAdminPath("charts")).toBe(false)
    })
})

describe(navigateTo, () => {
    it("pushes onto the captured router history", () => {
        const history = fakeHistory()
        setAdminHistory(history)
        const result = navigateTo("/charts", { search: "chartSearch=co2" })
        expect(result).toEqual({ ok: true, path: "/charts?chartSearch=co2" })
        expect(history.push).toHaveBeenCalledWith({
            pathname: "/charts",
            search: "?chartSearch=co2",
        })
    })

    it("refuses while a guard reports a reason, and drops the guard on abort", () => {
        const history = fakeHistory()
        setAdminHistory(history)
        const controller = new AbortController()
        registerNavigationGuard(() => "unsaved changes", controller.signal)

        expect(navigationBlockedReason()).toBe("unsaved changes")
        expect(navigateTo("/charts")).toEqual({
            ok: false,
            reason: "unsaved changes",
        })
        expect(history.push).not.toHaveBeenCalled()

        controller.abort()
        expect(navigationBlockedReason()).toBeUndefined()
        expect(navigateTo("/charts").ok).toBe(true)
    })

    it("refuses invalid paths before consulting guards or history", () => {
        const history = fakeHistory()
        setAdminHistory(history)
        expect(navigateTo("https://example.org").ok).toBe(false)
        expect(history.push).not.toHaveBeenCalled()
    })
})
