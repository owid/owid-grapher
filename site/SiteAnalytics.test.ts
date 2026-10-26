/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { EventCategory } from "@ourworldindata/types"
import { SiteAnalytics } from "./SiteAnalytics.js"

// The `dataLayer` global is typed inside the grapher package, not here
const gtmWindow = window as unknown as {
    dataLayer: Record<string, unknown>[]
}

// happy-dom reports a non-Apple platform, so `$mod` is Ctrl in these tests
describe("find-in-page tracking", () => {
    let stop: () => void

    const findEvents = () =>
        gtmWindow.dataLayer.filter(
            (e) => e.event === EventCategory.SiteFindInPage
        )

    const press = (
        init: KeyboardEventInit,
        target: EventTarget = document
    ): KeyboardEvent => {
        const ev = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            ...init,
        })
        target.dispatchEvent(ev)
        return ev
    }

    const ctrlF = { key: "f", code: "KeyF", ctrlKey: true }

    beforeEach(() => {
        gtmWindow.dataLayer = []
        stop = new SiteAnalytics().startFindInPageTracking()
    })

    afterEach(() => stop())

    it("logs the find shortcut once per page view", () => {
        press(ctrlF)
        press(ctrlF)
        press({ key: "F3", code: "F3" })

        expect(findEvents()).toEqual([
            expect.objectContaining({
                eventAction: "open",
                eventContext: "mod+f",
            }),
        ])
    })

    it("logs F3, with or without Shift", () => {
        press({ key: "F3", code: "F3", shiftKey: true })
        expect(findEvents()).toEqual([
            expect.objectContaining({
                eventAction: "open",
                eventContext: "f3",
            }),
        ])
    })

    it("follows the produced key, with a physical-key fallback", () => {
        // Dvorak: the physical F key types "u", and Ctrl+U isn't find
        press({ key: "u", code: "KeyF", ctrlKey: true })
        expect(findEvents()).toEqual([])

        // Cyrillic: Ctrl+F types "а", and browsers still open find
        press({ key: "а", code: "KeyF", ctrlKey: true })
        expect(findEvents()).toEqual([
            expect.objectContaining({
                eventAction: "open",
                eventContext: "mod+f",
            }),
        ])
    })

    it("ignores other shortcuts", () => {
        press({ key: "f", code: "KeyF" })
        press({ ...ctrlF, shiftKey: true })
        press({ ...ctrlF, metaKey: true })
        press({ key: "f", code: "KeyF", metaKey: true }) // not $mod here
        press({ key: "g", code: "KeyG", ctrlKey: true })
        press({ key: "F3", code: "F3", altKey: true })
        press({ ...ctrlF, repeat: true })
        expect(findEvents()).toHaveLength(0)
    })

    it("counts the shortcut inside text fields", () => {
        const input = document.createElement("input")
        document.body.append(input)
        press(ctrlF, input)
        input.remove()
        expect(findEvents()).toHaveLength(1)
    })

    it("never blocks the browser's find bar", () => {
        expect(press(ctrlF).defaultPrevented).toBe(false)
    })

    it("ignores key events without a key, e.g. from autofill", () => {
        expect(() => press({})).not.toThrow()
        expect(findEvents()).toHaveLength(0)
    })
})
