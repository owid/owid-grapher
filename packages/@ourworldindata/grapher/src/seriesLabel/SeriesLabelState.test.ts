import { describe, expect, it } from "vitest"
import { Bounds } from "@ourworldindata/utils"
import {
    SeriesLabelState,
    SeriesLabelStateOptions,
    TextRenderFragment,
    IconRenderFragment,
    RenderFragment,
} from "./SeriesLabelState"

const FONT_SIZE = 14
const LINE_HEIGHT = 1.1

function textWidth(text: string): number {
    return Bounds.forText(text, { fontSize: FONT_SIZE }).width
}

function spaceWidth(): number {
    return textWidth(" ")
}

function makeLabelState(
    overrides: Partial<SeriesLabelStateOptions> & { text: string }
): SeriesLabelState {
    return new SeriesLabelState({
        maxWidth: Infinity,
        fontSize: FONT_SIZE,
        ...overrides,
    })
}

function textFragments(fragments: RenderFragment[]): TextRenderFragment[] {
    return fragments.filter((f) => f.type === "text") as TextRenderFragment[]
}

function iconFragments(fragments: RenderFragment[]): IconRenderFragment[] {
    return fragments.filter((f) => f.type === "icon") as IconRenderFragment[]
}

describe("SeriesLabelState", () => {
    it("plain label has correct dimensions and fragments", () => {
        const label = makeLabelState({ text: "United States" })

        expect(label.width).toBe(textWidth("United States"))
        expect(label.height).toBe(FONT_SIZE * LINE_HEIGHT)

        const texts = textFragments(label.renderFragments)
        expect(texts).toHaveLength(1)
        expect(texts[0]).toMatchObject({ role: "name", x: 0, y: 0 })
    })

    it("splits provider suffix into separate fragments on the same line", () => {
        const label = makeLabelState({ text: "Africa (WHO)" })

        const texts = textFragments(label.renderFragments)
        const names = texts.filter((f) => f.role === "name")
        const suffixes = texts.filter((f) => f.role === "suffix")

        expect(names.length).toBeGreaterThanOrEqual(1)
        expect(suffixes.length).toBeGreaterThanOrEqual(1)
        // All on the same line
        expect(label.height).toBe(FONT_SIZE * LINE_HEIGHT)
    })

    it("width includes space between inline fragments", () => {
        const label = makeLabelState({ text: "Africa (WHO)" })
        const expected = textWidth("Africa") + spaceWidth() + textWidth("(WHO)")
        expect(label.width).toBeCloseTo(expected, 1)

        // Same for inline value
        const withValue = makeLabelState({
            text: "USA",
            formattedValue: "45%",
        })
        const expectedValue = textWidth("USA") + spaceWidth() + textWidth("45%")
        expect(withValue.width).toBeCloseTo(expectedValue, 1)
    })

    it("renders provider icon between suffix text fragments", () => {
        const label = makeLabelState({
            text: "Africa (WHO)",
            showProviderTooltip: true,
        })
        const texts = textFragments(label.renderFragments)
        const icons = iconFragments(label.renderFragments)
        const suffixes = texts.filter((f) => f.role === "suffix")

        expect(icons).toHaveLength(1)
        expect(icons[0].providerKey).toBe("who")
        // "(WHO" before icon, ")" after
        expect(suffixes[0].text).toBe("(WHO")
        expect(suffixes[1].text).toBe(")")
        expect(icons[0].x).toBeGreaterThan(suffixes[0].x)
        expect(icons[0].x).toBeLessThan(suffixes[1].x)
    })

    it("places value on new line when suffix is present", () => {
        const label = makeLabelState({
            text: "Africa (WHO)",
            formattedValue: "72%",
        })

        expect(label.height).toBe(FONT_SIZE * LINE_HEIGHT * 2)

        const texts = textFragments(label.renderFragments)
        const value = texts.find((f) => f.role === "value")!
        expect(value.x).toBe(0)
        expect(value.y).toBeGreaterThan(0)
    })

    it("right-aligns fragments for textAnchor=end", () => {
        const label = makeLabelState({
            text: "Africa (WHO)",
            textAnchor: "end",
        })
        // All fragments should have non-positive x (right edge at 0)
        for (const fragment of label.renderFragments) {
            expect(fragment.x).toBeLessThanOrEqual(0)
        }
    })

    it("non-provider suffix is not split from name", () => {
        const text = "Africa (custom group)"
        const label = makeLabelState({ text })

        expect(label.width).toBe(textWidth(text))
        const texts = textFragments(label.renderFragments)
        expect(texts.every((f) => f.role === "name")).toBe(true)
    })
})
