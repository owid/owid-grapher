import { describe, expect, it } from "vitest"

import {
    formatFlopInWords,
    formatPowerOfTenTick,
    formatScientific,
} from "./formatFlop.js"
import { getOrganizationGroup } from "./organizations.js"
import { getDomainGroup, getSectorGroup } from "./colorSchemes.js"
import { getYearTicks, getYExponentDomain, getYTickExponents } from "./axes.js"
import { placeLabels } from "./labelPlacement.js"
import { COMPUTER_SYSTEMS, getMonthOfComputation } from "./computers.js"
import { spreadLabels } from "./labelLayout.js"
import { AI_MODELS } from "./data.js"

describe(formatFlopInWords, () => {
    it.each([
        [40, "40"],
        [4_000, "4,000"],
        [1.5e6, "1.5 million"],
        [9.4e26, "940 septillion"],
        [3.14e23, "310 sextillion"],
        [1e27, "1 octillion"],
        // Rounding up across a power of ten
        [9.96e25, "100 septillion"],
        // Rounding up across a scale boundary picks the larger name
        [999_999_999, "1 billion"],
    ])("%d → %s", (value, expected) => {
        expect(formatFlopInWords(value)).toBe(expected)
    })

    it("labels axis ticks at exact powers of ten", () => {
        expect(formatPowerOfTenTick(3)).toBe("1,000")
        expect(formatPowerOfTenTick(14)).toBe("100 trillion")
        expect(formatPowerOfTenTick(24)).toBe("1 septillion")
    })
})

describe(formatScientific, () => {
    it("uses superscript exponents and drops a mantissa of 1", () => {
        expect(formatScientific(9.4e26)).toBe("9.4 × 10²⁶")
        expect(formatScientific(1e25)).toBe("10²⁵")
        expect(formatScientific(9.97e25)).toBe("10²⁶")
    })
})

describe(getOrganizationGroup, () => {
    it("merges Google's labs into one group", () => {
        expect(getOrganizationGroup("Google DeepMind", "Industry")).toBe(
            "Google"
        )
        expect(getOrganizationGroup("DeepMind", "Industry")).toBe("Google")
    })

    it("credits a co-developed model to the first named lab", () => {
        expect(
            getOrganizationGroup(
                "University of Toronto,Google Brain",
                "Academia,Industry"
            )
        ).toBe("Google")
    })

    it("falls back on Epoch's categorization", () => {
        expect(getOrganizationGroup("Mistral AI", "Industry")).toBe(
            "Other companies"
        )
        expect(getOrganizationGroup("Stanford University", "Academia")).toBe(
            "Academia & others"
        )
        expect(getOrganizationGroup(null, null)).toBe("Academia & others")
    })
})

describe(spreadLabels, () => {
    it("leaves labels that already have room where they are", () => {
        expect(spreadLabels([0, 50, 100], 10, { min: -100, max: 200 })).toEqual(
            [0, 50, 100]
        )
    })

    it("pushes overlapping labels apart around their mean, in input order", () => {
        expect(spreadLabels([104, 100], 10, { min: 0, max: 200 })).toEqual([
            107, 97,
        ])
    })

    it("keeps the stack inside the bounds", () => {
        expect(spreadLabels([0, 1], 10, { min: 0, max: 100 })).toEqual([0, 10])
    })
})

describe("bundled data", () => {
    it("includes GPT-6 Astra with a source link", () => {
        const astra = AI_MODELS.find((m) => m.model === "GPT-6 Astra")
        expect(astra?.groups.organization).toBe("OpenAI")
        expect(astra?.link).toMatch(/^https:\/\/openai\.com\//)
    })
})

describe(getDomainGroup, () => {
    it("prefers the most distinctive domain over Language", () => {
        expect(getDomainGroup("Multimodal,Language,Vision")).toBe("Language")
        expect(getDomainGroup("Language,Biology")).toBe("Science")
        expect(getDomainGroup("Vision,Image generation")).toBe("Drawing")
        expect(getDomainGroup("Games")).toBe("Games")
        expect(getDomainGroup("Speech")).toBe("Other")
        expect(getDomainGroup(null)).toBe("Other")
    })
})

describe(getSectorGroup, () => {
    it("separates industry, academia and collaborations between them", () => {
        expect(getSectorGroup("Industry,Industry")).toBe("Industry")
        expect(getSectorGroup("Academia")).toBe("Academia")
        expect(getSectorGroup("Academia,Industry,Government")).toBe(
            "Industry–academia collaboration"
        )
        expect(getSectorGroup("Government")).toBe("Other")
    })
})

describe(getYExponentDomain, () => {
    it("starts at 1 for the full history and snaps to labeled gridlines when zoomed", () => {
        // Theseus (40 FLOP) to GPT-6 Astra (9.4 × 10²⁶)
        expect(getYExponentDomain([40, 9.4e26])).toEqual([0, 28])
        // Zoomed into the deep learning era
        expect(getYExponentDomain([5e15, 9.4e26])).toEqual([15, 28])
    })
})

describe(getYTickExponents, () => {
    it("labels every thousandfold step, or every step when zoomed in close", () => {
        expect(getYTickExponents([0, 28], 500)).toEqual([
            0, 3, 6, 9, 12, 15, 18, 21, 24, 27,
        ])
        expect(getYTickExponents([21, 27], 500)).toEqual([
            21, 22, 23, 24, 25, 26, 27,
        ])
    })
})

describe(getYearTicks, () => {
    it("uses round steps that leave room for the labels", () => {
        expect(getYearTicks([1940, 2027], 600)).toEqual([
            1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020,
        ])
        expect(getYearTicks([2020, 2027], 600)).toEqual([
            2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027,
        ])
    })
})

describe(placeLabels, () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 }
    const box = (x: number, y: number) => ({ x, y, width: 20, height: 10 })

    it("moves a label to its next option when the first collides", () => {
        const placed = placeLabels(
            [
                { item: "a", options: [box(0, 0)] },
                { item: "b", options: [box(5, 0), box(5, 30)] },
            ],
            bounds
        )
        expect(placed.map((p) => [p.item, p.optionIndex])).toEqual([
            ["a", 0],
            ["b", 1],
        ])
    })

    it("drops labels with no free option, including outside the bounds", () => {
        const placed = placeLabels(
            [
                { item: "a", options: [box(0, 0)] },
                { item: "b", options: [box(5, 0), box(95, 50)] },
            ],
            bounds
        )
        expect(placed.map((p) => p.item)).toEqual(["a"])
    })
})

describe("computer systems", () => {
    it("are compared at one month of running", () => {
        const h100 = COMPUTER_SYSTEMS.find((c) => c.id === "h100")!
        expect(formatFlopInWords(getMonthOfComputation(h100))).toBe(
            "2.6 sextillion"
        )
    })
})
