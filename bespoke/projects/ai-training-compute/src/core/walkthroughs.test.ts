import { describe, expect, it } from "vitest"

import { parseRichText } from "./richText.js"
import { DEFAULT_VIEW_STATE } from "./viewState.js"
import {
    WALKTHROUGHS,
    clampSlide,
    findWalkthrough,
    resolveSlideView,
} from "./walkthroughs.js"

describe(parseRichText, () => {
    it("splits out **bold** spans", () => {
        expect(parseRichText("Only **30** of them")).toEqual([
            { text: "Only ", bold: false },
            { text: "30", bold: true },
            { text: " of them", bold: false },
        ])
    })
})

describe("walkthroughs", () => {
    it("each have a unique id and at least two slides", () => {
        const ids = WALKTHROUGHS.map((w) => w.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const walkthrough of WALKTHROUGHS)
            expect(walkthrough.slides.length).toBeGreaterThanOrEqual(2)
    })

    it("fill in every figure they quote from the data", () => {
        for (const walkthrough of WALKTHROUGHS)
            for (const slide of walkthrough.slides) {
                const text = `${slide.text} ${slide.secondLine ?? ""}`
                expect(text).not.toMatch(/undefined|NaN|–(?= in)/)
            }
    })
})

describe(resolveSlideView, () => {
    it("lays a slide's view over the default, not the reader's", () => {
        const view = resolveSlideView({
            text: "",
            view: { showComputers: true },
        })
        expect(view).toEqual({ ...DEFAULT_VIEW_STATE, showComputers: true })
    })
})

describe(clampSlide, () => {
    it("keeps slide numbers within the walkthrough", () => {
        const walkthrough = findWalkthrough("missing-frontier-models")!
        expect(clampSlide(0, walkthrough)).toBe(1)
        expect(clampSlide(99, walkthrough)).toBe(walkthrough.slides.length)
    })
})
