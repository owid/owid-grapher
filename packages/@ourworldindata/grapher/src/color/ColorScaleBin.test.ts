import { expect, it, describe } from "vitest"

import {
    CategoricalBin,
    dedupeRepeatedBins,
    mergeCategoricalBinsByLabelAndColor,
    NumericBin,
} from "./ColorScaleBin"

it("can create a bin", () => {
    const bin = new CategoricalBin({
        index: 1,
        value: "North America",
        label: "100",
        color: "red",
    })
    expect(bin.color).toEqual("red")
})

describe(NumericBin, () => {
    const defaultBinProps = {
        min: 0,
        max: 10,
        isFirst: false,
        isOpenLeft: false,
        isOpenRight: false,
        displayMin: "",
        displayMax: "",
        color: "",
    }

    describe("contains", () => {
        it("normal contains", () => {
            const bin = new NumericBin({
                ...defaultBinProps,
            })

            expect(bin.contains(0)).toBe(false)
            expect(bin.contains(1)).toBe(true)
            expect(bin.contains(10)).toBe(true)
        })

        it("left-open bin", () => {
            const bin = new NumericBin({
                ...defaultBinProps,
                isOpenLeft: true,
            })

            expect(bin.contains(-100)).toBe(true)
            expect(bin.contains(0)).toBe(true)
            expect(bin.contains(10)).toBe(true)
        })

        it("right-open bin", () => {
            const bin = new NumericBin({
                ...defaultBinProps,
                isOpenRight: true,
            })

            expect(bin.contains(0)).toBe(false)
            expect(bin.contains(10)).toBe(true)
            expect(bin.contains(100)).toBe(true)
        })

        it("left- and right-open bin", () => {
            const bin = new NumericBin({
                ...defaultBinProps,
                isOpenLeft: true,
                isOpenRight: true,
            })

            expect(bin.contains(-100)).toBe(true)
            expect(bin.contains(0)).toBe(true)
            expect(bin.contains(10)).toBe(true)
            expect(bin.contains(100)).toBe(true)
        })

        it("first bin should include min", () => {
            const bin = new NumericBin({
                ...defaultBinProps,
                isFirst: true,
            })

            expect(bin.contains(-1)).toBe(false)
            expect(bin.contains(0)).toBe(true)
            expect(bin.contains(10)).toBe(true)
            expect(bin.contains(100)).toBe(false)
        })

        it("first right-open bin should include min", () => {
            const bin = new NumericBin({
                ...defaultBinProps,
                isFirst: true,
                isOpenRight: true,
            })

            expect(bin.contains(-1)).toBe(false)
            expect(bin.contains(0)).toBe(true)
            expect(bin.contains(10)).toBe(true)
            expect(bin.contains(100)).toBe(true)
        })
    })
})

describe(CategoricalBin, () => {
    it("contains only its own value by default", () => {
        const bin = new CategoricalBin({
            index: 0,
            value: "Committed",
            label: "Committed",
            color: "green",
        })
        expect(bin.contains("Committed")).toBe(true)
        expect(bin.contains("Pledged")).toBe(false)
        expect(bin.values).toEqual(["Committed"])
    })

    it("contains all of its values when merged", () => {
        const bin = new CategoricalBin({
            index: 0,
            value: "In law",
            label: "Committed",
            color: "green",
            additionalValues: ["In policy document"],
        })
        expect(bin.contains("In law")).toBe(true)
        expect(bin.contains("In policy document")).toBe(true)
        expect(bin.contains("Pledged")).toBe(false)
    })
})

describe(mergeCategoricalBinsByLabelAndColor, () => {
    it("collapses bins with identical label and color into one entry", () => {
        const bins = [
            new CategoricalBin({
                index: 0,
                value: "In law",
                label: "Committed",
                color: "green",
            }),
            new CategoricalBin({
                index: 1,
                value: "In policy document",
                label: "Committed",
                color: "green",
            }),
            new CategoricalBin({
                index: 3,
                value: "Pledged",
                label: "Pledged",
                color: "orange",
            }),
            new CategoricalBin({
                index: 2,
                value: "Announced",
                label: "Committed",
                color: "green",
            }),
        ]

        const merged = mergeCategoricalBinsByLabelAndColor(bins)

        expect(merged).toHaveLength(2)
        expect(merged.map((bin) => bin.text)).toEqual(["Committed", "Pledged"])

        const committed = merged[0]
        expect(committed.values).toEqual([
            "In law",
            "In policy document",
            "Announced",
        ])
        expect(committed.contains("In law")).toBe(true)
        expect(committed.contains("In policy document")).toBe(true)
        expect(committed.contains("Announced")).toBe(true)
        // It keeps the first member's index, so `equals`-based hover matching
        // still resolves back to this one bin.
        expect(committed.equals(bins[0])).toBe(true)
    })

    it("keeps a merged bin at the position of its first appearance", () => {
        const bins = [
            new CategoricalBin({
                index: 0,
                value: "In law",
                label: "Committed",
                color: "green",
            }),
            new CategoricalBin({
                index: 1,
                value: "Pledged",
                label: "Pledged",
                color: "orange",
            }),
            new CategoricalBin({
                index: 2,
                value: "In policy document",
                label: "Committed",
                color: "green",
            }),
        ]

        const merged = mergeCategoricalBinsByLabelAndColor(bins)

        expect(merged.map((bin) => bin.text)).toEqual(["Committed", "Pledged"])
    })

    it("does not merge bins that differ in label or color", () => {
        const differentLabel = [
            new CategoricalBin({
                index: 0,
                value: "a",
                label: "Label A",
                color: "green",
            }),
            new CategoricalBin({
                index: 1,
                value: "b",
                label: "Label B",
                color: "green",
            }),
        ]
        expect(
            mergeCategoricalBinsByLabelAndColor(differentLabel)
        ).toHaveLength(2)

        const differentColor = [
            new CategoricalBin({
                index: 0,
                value: "a",
                label: "Same label",
                color: "green",
            }),
            new CategoricalBin({
                index: 1,
                value: "b",
                label: "Same label",
                color: "orange",
            }),
        ]
        expect(
            mergeCategoricalBinsByLabelAndColor(differentColor)
        ).toHaveLength(2)
    })

    it("leaves a single-member group's original bin untouched", () => {
        const bin = new CategoricalBin({
            index: 0,
            value: "only",
            label: "Only",
            color: "green",
        })
        const [merged] = mergeCategoricalBinsByLabelAndColor([bin])
        expect(merged).toBe(bin)
        expect(merged.props.additionalValues).toBeUndefined()
    })
})

describe(dedupeRepeatedBins, () => {
    it("drops categorical bins repeating an earlier bin's text", () => {
        // The same categories coming from two facets, with differing indexes
        const bins = [
            new CategoricalBin({
                index: 0,
                value: "Asia",
                label: "Asia",
                color: "red",
            }),
            new CategoricalBin({
                index: 1,
                value: "Europe",
                label: "Europe",
                color: "blue",
            }),
            new CategoricalBin({
                index: 1,
                value: "Asia",
                label: "Asia",
                color: "red",
            }),
            new CategoricalBin({
                index: 0,
                value: "Europe",
                label: "Europe",
                color: "blue",
            }),
        ]

        const deduped = dedupeRepeatedBins(bins)

        expect(deduped).toHaveLength(2)
        expect(deduped[0]).toBe(bins[0])
        expect(deduped[1]).toBe(bins[1])
    })
})
