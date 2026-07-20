import { expect, it, describe } from "vitest"

import {
    CategoricalBin,
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
        const bin = makeCategoricalBin(0, "Committed", "Committed", "green")
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
            values: ["In law", "In policy document"],
        })
        expect(bin.contains("In law")).toBe(true)
        expect(bin.contains("In policy document")).toBe(true)
        expect(bin.contains("Pledged")).toBe(false)
    })
})

describe(mergeCategoricalBinsByLabelAndColor, () => {
    it("collapses bins with identical label and color into one entry", () => {
        const bins = [
            makeCategoricalBin(0, "In law", "Committed", "green"),
            makeCategoricalBin(1, "In policy document", "Committed", "green"),
            makeCategoricalBin(2, "Pledged", "Pledged", "orange"),
        ]

        const merged = mergeCategoricalBinsByLabelAndColor(bins)

        expect(merged).toHaveLength(2)
        expect(merged.map((bin) => bin.text)).toEqual(["Committed", "Pledged"])

        // The merged bin matches both underlying values, so hovering it still
        // highlights every country in either category.
        const [committed] = merged
        expect(committed.values).toEqual(["In law", "In policy document"])
        expect(committed.contains("In law")).toBe(true)
        expect(committed.contains("In policy document")).toBe(true)
        // It keeps the first member's index, so `equals`-based hover matching
        // still resolves back to this one bin.
        expect(committed.equals(bins[0])).toBe(true)
    })

    it("does not merge bins that differ in label or color", () => {
        const differentLabel = [
            makeCategoricalBin(0, "a", "Label A", "green"),
            makeCategoricalBin(1, "b", "Label B", "green"),
        ]
        expect(
            mergeCategoricalBinsByLabelAndColor(differentLabel)
        ).toHaveLength(2)

        const differentColor = [
            makeCategoricalBin(0, "a", "Same label", "green"),
            makeCategoricalBin(1, "b", "Same label", "orange"),
        ]
        expect(
            mergeCategoricalBinsByLabelAndColor(differentColor)
        ).toHaveLength(2)
    })

    it("leaves a single-member group's original bin untouched", () => {
        const bin = makeCategoricalBin(0, "only", "Only", "green")
        const [merged] = mergeCategoricalBinsByLabelAndColor([bin])
        expect(merged).toBe(bin)
        expect(merged.props.values).toBeUndefined()
    })
})

function makeCategoricalBin(
    index: number,
    value: string,
    label: string,
    color: string
): CategoricalBin {
    return new CategoricalBin({ index, value, label, color })
}
