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

    const makeDetails = (summaryText: string) => {
        const details = document.createElement("details")
        details.innerHTML = `<summary>  ${summaryText}\n </summary><p>Body</p>`
        document.body.appendChild(details)
        return details
    }

    const open = (details: HTMLDetailsElement) => {
        details.open = true
        details.dispatchEvent(new Event("toggle"))
    }

    beforeEach(() => {
        gtmWindow.dataLayer = []
        document.body.innerHTML = ""
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

    it("ignores other shortcuts", () => {
        press({ key: "f" })
        press({ key: "f", metaKey: true, shiftKey: true })
        press({ key: "g", metaKey: true })
        expect(findEvents()).toEqual([])
    })

    it("logs a <details> opened without page interaction as a reveal", () => {
        const details = makeDetails("How is this   measured?")
        open(details)
        details.open = false
        open(details)

        expect(findEvents()).toEqual([
            expect.objectContaining({
                eventAction: "reveal",
                eventTarget: "How is this measured?",
            }),
        ])
    })

    it("does not count a <details> opened by a click or keypress", () => {
        const clicked = makeDetails("Clicked")
        clicked.dispatchEvent(new PointerEvent("pointerdown"))
        open(clicked)

        const keyed = makeDetails("Keyed")
        keyed.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
        open(keyed)

        expect(findEvents()).toEqual([])
    })

    it("does not treat the find shortcut as an interaction", () => {
        press({ key: "f", metaKey: true })
        open(makeDetails("Found"))

        expect(findEvents().map((e) => e.eventAction)).toEqual([
            "open",
            "reveal",
        ])
    })
})
