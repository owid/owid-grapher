/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest"
import { DOD_LOCATION_ATTR, getDodLocation } from "./detailsOnDemand.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

describe("resolving a DoD span's page location", () => {
    it("returns the nearest marker's location", () => {
        document.body.innerHTML = `
            <div ${DOD_LOCATION_ATTR}="faqs">
                <details><p>text <span class="dod-span" data-id="x">term</span></p></details>
            </div>`
        expect(getDodLocation(document.querySelector(".dod-span")!)).toBe(
            "faqs"
        )
    })

    it("prefers the innermost marker when markers nest", () => {
        document.body.innerHTML = `
            <div ${DOD_LOCATION_ATTR}="outer">
                <div ${DOD_LOCATION_ATTR}="wysk/expanded">
                    <span class="dod-span" data-id="x">term</span>
                </div>
            </div>`
        expect(getDodLocation(document.querySelector(".dod-span")!)).toBe(
            "wysk/expanded"
        )
    })

    it("is undefined on pages without markers", () => {
        document.body.innerHTML = `<p><span class="dod-span" data-id="x">term</span></p>`
        expect(
            getDodLocation(document.querySelector(".dod-span")!)
        ).toBeUndefined()
    })
})

describe("SiteAnalytics.logDodShown", () => {
    type DL = Record<string, unknown>[]
    beforeEach(() => {
        ;(window as unknown as { dataLayer: DL }).dataLayer = []
    })
    const pushed = (): DL => (window as unknown as { dataLayer: DL }).dataLayer

    it("sends the location as eventContext when known", () => {
        new SiteAnalytics().logDodShown("ghgemissions", "wysk")
        expect(pushed()).toHaveLength(1)
        expect(pushed()[0]).toMatchObject({
            event: "owid.detail_on_demand",
            eventAction: "show",
            eventTarget: "ghgemissions",
            eventContext: "wysk",
        })
    })

    it("keeps the existing event shape when the location is unknown", () => {
        new SiteAnalytics().logDodShown("ghgemissions")
        expect(pushed()).toHaveLength(1)
        expect(pushed()[0]).toMatchObject({
            event: "owid.detail_on_demand",
            eventAction: "show",
            eventTarget: "ghgemissions",
        })
        expect(pushed()[0]).not.toHaveProperty("eventContext")
    })
})
