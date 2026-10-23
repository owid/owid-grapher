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

describe("find-in-page tracking", () => {
    let stop: () => void

    const findEvents = () =>
        gtmWindow.dataLayer.filter(
            (e) => e.event === EventCategory.SiteFindInPage
        )

    const press = (init: KeyboardEventInit) =>
        document.dispatchEvent(new KeyboardEvent("keydown", init))

    beforeEach(() => {
        gtmWindow.dataLayer = []
        stop = new SiteAnalytics().startFindInPageTracking()
    })

    afterEach(() => stop())

    it("logs the find shortcut once per page view", () => {
        press({ key: "f", metaKey: true })
        press({ key: "f", ctrlKey: true })
        press({ key: "F3" })

        expect(findEvents()).toEqual([
            expect.objectContaining({
                eventAction: "open",
                eventContext: "mod+f",
            }),
        ])
    })

    it("logs F3", () => {
        press({ key: "F3" })
        expect(findEvents()).toEqual([
            expect.objectContaining({
                eventAction: "open",
                eventContext: "f3",
            }),
        ])
    })

    it("follows the produced key, with a physical-key fallback", () => {
        // Dvorak: the physical F key types "u", and Cmd+U isn't find
        press({ key: "u", code: "KeyF", metaKey: true })
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
        press({ key: "f" })
        press({ key: "f", metaKey: true, shiftKey: true })
        press({ key: "g", metaKey: true })
        expect(findEvents()).toEqual([])
    })
})
