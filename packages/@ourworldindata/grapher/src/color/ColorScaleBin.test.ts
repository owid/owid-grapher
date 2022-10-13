#! /usr/bin/env jest

import { CategoricalBin, NumericBin } from "./ColorScaleBin"

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
