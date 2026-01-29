import { describe, expect, it } from "vitest"

import { getPixelWidth, FontFamily } from "./stringWidth.js"

describe("getPixelWidth", () => {
    it("calculates width for basic ASCII text", () => {
        const width = getPixelWidth("Hello", {
            font: FontFamily.Lato,
            size: 100,
        })
        expect(width).toBeGreaterThan(0)
        // H=76, e=53, l=24, l=24, o=57 = 234
        expect(width).toBe(234)
    })

    it("handles diacritics by stripping combining marks", () => {
        // "café" should have the same width as "cafe"
        // because the acute accent (´) is a combining mark that gets stripped
        const widthWithAccent = getPixelWidth("café", {
            font: FontFamily.Lato,
            size: 100,
        })
        const widthWithoutAccent = getPixelWidth("cafe", {
            font: FontFamily.Lato,
            size: 100,
        })
        expect(widthWithAccent).toBe(widthWithoutAccent)
    })

    it("handles various accented characters", () => {
        // All these should normalize to the same base character width
        const baseWidth = getPixelWidth("e", {
            font: FontFamily.Lato,
            size: 100,
        })
        expect(getPixelWidth("é", { font: FontFamily.Lato, size: 100 })).toBe(
            baseWidth
        )
        expect(getPixelWidth("è", { font: FontFamily.Lato, size: 100 })).toBe(
            baseWidth
        )
        expect(getPixelWidth("ê", { font: FontFamily.Lato, size: 100 })).toBe(
            baseWidth
        )
        expect(getPixelWidth("ë", { font: FontFamily.Lato, size: 100 })).toBe(
            baseWidth
        )
    })

    it("scales width by font size", () => {
        const width100 = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
        })
        const width50 = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 50,
        })
        const width200 = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 200,
        })

        expect(width50).toBe(width100 / 2)
        expect(width200).toBe(width100 * 2)
    })

    it("uses different widths for bold variant", () => {
        const regular = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
        })
        const bold = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
            bold: true,
        })
        // Bold text is typically wider
        expect(bold).toBeGreaterThan(regular)
    })

    it("uses different widths for italic variant", () => {
        const regular = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
        })
        const italic = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
            italic: true,
        })
        expect(italic).not.toBe(regular)
    })

    it("handles bold+italic variant", () => {
        const regular = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
        })
        const boldItalic = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
            bold: true,
            italic: true,
        })
        expect(boldItalic).not.toBe(regular)
    })

    it("supports playfair display font", () => {
        const latoWidth = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
        })
        const playfairWidth = getPixelWidth("Test", {
            font: FontFamily.PlayfairDisplay,
            size: 100,
        })
        // Different fonts should have different widths
        expect(playfairWidth).not.toBe(latoWidth)
    })

    it("skips control characters", () => {
        // Control characters (0x00-0x1F) should not contribute to width
        const withControl = getPixelWidth("a\x00\x01\x1Fb", {
            font: FontFamily.Lato,
            size: 100,
        })
        const withoutControl = getPixelWidth("ab", {
            font: FontFamily.Lato,
            size: 100,
        })
        expect(withControl).toBe(withoutControl)
    })

    it("uses fallback width for unknown characters", () => {
        // Unknown characters should use 'x' width as fallback
        const xWidth = getPixelWidth("x", { font: FontFamily.Lato, size: 100 })
        const unknownWidth = getPixelWidth("中", {
            font: FontFamily.Lato,
            size: 100,
        })
        expect(unknownWidth).toBe(xWidth)
    })

    it("handles empty string", () => {
        const width = getPixelWidth("", { font: FontFamily.Lato, size: 100 })
        expect(width).toBe(0)
    })

    it("defaults to lato font when not specified", () => {
        const withFont = getPixelWidth("Test", {
            font: FontFamily.Lato,
            size: 100,
        })
        const withoutFont = getPixelWidth("Test", { size: 100 })
        expect(withoutFont).toBe(withFont)
    })

    it("throws error for unsupported font", () => {
        expect(() =>
            getPixelWidth("Test", {
                font: "unsupported" as FontFamily,
                size: 100,
            })
        ).toThrow("This font is not supported")
    })

    it("has data for subscript numbers", () => {
        const co2Normal = getPixelWidth("CO2", {})
        const co2Subscript = getPixelWidth("CO₂", {})

        expect(co2Subscript).toBeLessThan(co2Normal)
    })
})
