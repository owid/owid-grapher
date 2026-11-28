import { describe, expect, it } from "vitest"

import {
    formatFlopInWords,
    formatPowerOfTenTick,
    formatScientific,
} from "./formatFlop.js"
import { getOrganizationGroup } from "./organizations.js"
import {
    getComputeStatus,
    getDomainGroup,
    getSectorGroup,
} from "./colorSchemes.js"
import { getLeaderSegments, getLeaderSegmentsSince } from "./eci.js"
import { getComputeRange } from "./uncertainty.js"
import {
    getLinearYMax,
    getLinearYTicks,
    getYearTicks,
    getYExponentDomain,
    getYTickExponents,
} from "./axes.js"
import { placeLabels } from "./labelPlacement.js"
import {
    COMPUTER_SYSTEMS,
    SHOWN_COMPUTERS,
    getMonthOfComputation,
    getRecordHolders,
} from "./computers.js"
import { getLargestRunInDeviceMonths } from "./hardwareComparison.js"
import { spreadLabels } from "./labelLayout.js"
import { AI_MODELS, getModels } from "./data.js"

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
    it("labels every thousandfold step, or every second one when space is tight", () => {
        expect(getYTickExponents([0, 28], 500)).toEqual([
            0, 3, 6, 9, 12, 15, 18, 21, 24, 27,
        ])
        expect(getYTickExponents([21, 27], 500)).toEqual([21, 24, 27])
        expect(getYTickExponents([0, 28], 200)).toEqual([0, 6, 12, 18, 24])
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

describe(getComputeStatus, () => {
    it("counts a figure as reported whenever the developer reported it", () => {
        expect(getComputeStatus(1e24, "Reported,Operation counting")).toBe(
            "Reported by developer"
        )
        expect(getComputeStatus(1e24, "Hardware")).toBe("Epoch estimate")
        // Epoch sometimes leaves the method blank on its own estimates
        expect(getComputeStatus(9.4e26, null)).toBe("Epoch estimate")
        expect(getComputeStatus(null, "Benchmarks")).toBe("No estimate")
    })
})

describe(getLeaderSegments, () => {
    const score = (model: string, date: string, eci: number) => ({
        model,
        displayName: model,
        organization: "Lab",
        date,
        eci,
        eciLow: eci - 2,
        eciHigh: eci + 2,
        trainingComputeFlop: null,
        computeEstimationMethod: null,
    })
    const day = (date: string) => Date.parse(`${date}T00:00:00Z`)
    const scores = [
        score("A", "2023-06-01", 100),
        score("B", "2024-03-01", 110),
        // Released the same day as a better model: never leads
        score("C small", "2024-06-01", 112),
        score("C large", "2024-06-01", 115),
        // Worse than the leader: never leads
        score("D", "2024-09-01", 114),
        score("E", "2025-01-01", 120),
    ]

    it("follows the running best score, clipped to the range", () => {
        const segments = getLeaderSegments(scores, {
            start: day("2024-01-01"),
            end: day("2025-03-01"),
        })
        expect(segments.map((s) => s.score.model)).toEqual([
            "A",
            "B",
            "C large",
            "E",
        ])
        // A led before the range starts; its segment starts at the range
        expect(segments[0].start).toBe(day("2024-01-01"))
        expect(segments[2].end).toBe(day("2025-01-01"))
        expect(segments.at(-1)?.isOngoing).toBe(true)
        expect(segments[1].isOngoing).toBe(false)
    })
})

describe(getLeaderSegmentsSince, () => {
    const score = (model: string, date: string, eci: number) => ({
        model,
        displayName: model,
        organization: "Lab",
        date,
        eci,
        eciLow: null,
        eciHigh: null,
        trainingComputeFlop: null,
        computeEstimationMethod: null,
    })
    const day = (date: string) => Date.parse(`${date}T00:00:00Z`)

    it("starts at the release of the model already leading", () => {
        const segments = getLeaderSegmentsSince(
            [score("Old", "2023-03-14", 100), score("New", "2024-06-01", 110)],
            { since: day("2024-01-01"), end: day("2025-01-01") }
        )
        expect(segments.map((s) => s.score.model)).toEqual(["Old", "New"])
        expect(segments[0].start).toBe(day("2023-03-14"))
    })
})

describe("developer groups", () => {
    it("count Microsoft and Nvidia as other companies", () => {
        expect(getOrganizationGroup("Microsoft Research", "Industry")).toBe(
            "Other companies"
        )
        expect(getOrganizationGroup("Nvidia", "Industry")).toBe(
            "Other companies"
        )
        // A named lab elsewhere in the list still wins
        expect(getOrganizationGroup("Nvidia,Meta AI", "Industry")).toBe("Meta")
    })
})

describe(getComputeRange, () => {
    it("spans the estimate divided and multiplied by Epoch's factor", () => {
        // Compare in orders of magnitude, clear of floating-point noise
        const log = (range?: [number, number]) => range?.map(Math.log10)
        const [low, high] = log(getComputeRange(1e25, "Likely"))!
        expect(low).toBeCloseTo(24)
        expect(high).toBeCloseTo(26)
        const [cLow, cHigh] = log(getComputeRange(1e25, "Confident"))!
        expect(cHigh - cLow).toBeCloseTo(2 * Math.log10(3))
        const [sLow, sHigh] = log(getComputeRange(1e25, "Speculative"))!
        expect(sHigh - sLow).toBeCloseTo(2 * Math.log10(31))
    })

    it("has no range for labels without a stated interval", () => {
        expect(getComputeRange(1e25, "Unknown")).toBeUndefined()
        expect(getComputeRange(1e25, undefined)).toBeUndefined()
    })
})

describe(getModels, () => {
    it("picks models among the N largest at their release", () => {
        for (const n of [1, 3, 5, 7])
            expect(getModels(n).every((m) => m.rankAtRelease <= n)).toBe(true)
        expect(getModels(5).length).toBeGreaterThan(getModels(1).length)
        expect(getModels(7).length).toBeGreaterThan(getModels(5).length)
    })

    it("counts GPT-6 Astra as the largest yet", () => {
        expect(getModels(1).some((m) => m.model === "GPT-6 Astra")).toBe(true)
    })

    it("clamps the cut-off to the ranks the data covers", () => {
        expect(getModels(99)).toEqual(getModels(7))
        expect(getModels(0)).toEqual(getModels(1))
    })

    it("has every model in some selection", () => {
        expect(
            AI_MODELS.every((m) => m.isNotable || m.rankAtRelease <= 7)
        ).toBe(true)
        expect(getModels("notable").every((m) => m.isNotable)).toBe(true)
    })
})

describe(getRecordHolders, () => {
    const system = (
        id: string,
        kind: "console" | "gpu",
        year: number,
        flopPerSecond: number
    ) => ({
        id,
        name: id,
        kind,
        year,
        flopPerSecond,
        description: "",
    })

    it("keeps only machines faster than every earlier one of their kind", () => {
        const holders = getRecordHolders([
            system("Big console", "console", 2017, 6e12),
            system("Handheld", "console", 2018, 4e11),
            system("Next console", "console", 2020, 1e13),
            system("Card", "gpu", 2018, 1e13),
        ])
        expect(holders.map((s) => s.id)).toEqual([
            "Big console",
            "Card",
            "Next console",
        ])
    })
})

describe(getLargestRunInDeviceMonths, () => {
    it("stays around a month or less until 2010, then pulls far ahead", () => {
        const until2010 = [1990, 2000, 2005, 2010].map(
            (year) =>
                getLargestRunInDeviceMonths(year, getModels(5), SHOWN_COMPUTERS)
                    ?.months ?? NaN
        )
        for (const months of until2010) expect(months).toBeLessThan(2)
        const recent = getLargestRunInDeviceMonths(
            2025,
            getModels(5),
            SHOWN_COMPUTERS
        )
        expect(recent?.months).toBeGreaterThan(1e5)
    })
})

describe(getLinearYMax, () => {
    it("leaves headroom over the largest value and rounds it", () => {
        for (const max of [4.8e26, 9.6e25, 3.1e24]) {
            const yMax = getLinearYMax([1e20, max])
            expect(yMax).toBeGreaterThanOrEqual(max * 1.05)
            expect(yMax).toBeLessThan(max * 1.5)
        }
    })

    it("falls back to 1 without positive values", () => {
        expect(getLinearYMax([])).toBe(1)
    })
})

describe(getLinearYTicks, () => {
    it("starts at zero and stays within the domain", () => {
        const ticks = getLinearYTicks(6e26, 400)
        expect(ticks[0]).toBe(0)
        expect(ticks.at(-1)).toBeLessThanOrEqual(6e26)
        expect(ticks.length).toBeGreaterThanOrEqual(3)
    })

    it("uses fewer ticks on short plots", () => {
        expect(getLinearYTicks(6e26, 120).length).toBeLessThan(
            getLinearYTicks(6e26, 600).length
        )
    })
})
