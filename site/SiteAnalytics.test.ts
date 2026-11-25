/**
 * @vitest-environment happy-dom
 */

import type { HTMLAttributes } from "react"
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    expectTypeOf,
    it,
} from "vitest"
import { EventCategory, type TrackNote } from "@ourworldindata/types"
import { SiteAnalytics } from "./SiteAnalytics.js"

// The `dataLayer` global is typed inside the grapher package, not here
const gtmWindow = window as unknown as {
    dataLayer: Record<string, unknown>[]
}

describe("click tracking", () => {
    it("only accepts listed track notes on HTML elements", () => {
        // Checked by `yarn typecheck`, through trackNoteAttribute.d.ts
        expectTypeOf<
            HTMLAttributes<HTMLElement>["data-track-note"]
        >().toEqualTypeOf<TrackNote | undefined>()
    })

    it("logs a click on a tracked element inside a chart as a grapher click", () => {
        gtmWindow.dataLayer = []
        new SiteAnalytics().startClickTracking()
        const grapherUrl = "https://ourworldindata.org/grapher/life-expectancy"
        document.body.innerHTML = `
            <figure data-grapher-url='${JSON.stringify({ grapherUrl })}'>
                <a data-track-note="chart_click_sources"><span>Sources</span></a>
            </figure>`

        document.querySelector("span")!.click()

        expect(gtmWindow.dataLayer).toEqual([
            expect.objectContaining({
                event: EventCategory.GrapherClick,
                eventAction: "chart_click_sources",
                grapherPath: "/grapher/life-expectancy",
            }),
        ])
    })
})

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
