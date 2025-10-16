import { expect, it, describe } from "vitest"

import {
    insertMissingValuePlaceholders,
    computeRollingAverage,
    extractDataSlugsFromTransformString,
} from "./Transforms.js"
import { ErrorValueTypes } from "./ErrorValues.js"
import { ErrorValue } from "@ourworldindata/types"

describe(insertMissingValuePlaceholders, () => {
    const testCases = [
        {
            values: [2, -3, 10],
            years: [0, 2, 3],
            expected: [2, ErrorValueTypes.MissingValuePlaceholder, -3, 10],
        },
    ]
    it("computes the rolling average", () => {
        testCases.forEach((testCase) => {
            expect(
                insertMissingValuePlaceholders(testCase.values, testCase.years)
            ).toEqual(testCase.expected)
        })
    })

    const testCasesWithMissing = [
        {
            values: [0, 2, 3],
            years: [0, 2, 3],
            expected: [0, ErrorValueTypes.MissingValuePlaceholder, 2, 2.5],
        },
    ]

    it("computes the rolling average for data with missing values", () => {
        testCasesWithMissing.forEach((testCase) => {
            expect(
                computeRollingAverage(
                    insertMissingValuePlaceholders(
                        testCase.values,
                        testCase.years
                    ),
                    2
                )
            ).toEqual(testCase.expected)
        })
    })
})

describe(computeRollingAverage, () => {
    const testCases: {
        numbers: (number | undefined | null)[]
        window: number
        align: "center" | "right"
        result: (number | ErrorValue)[]
    }[] = [
        // no smoothing
        {
            numbers: [2, 4, 6, 8],
            window: 1,
            align: "right",
            result: [2, 4, 6, 8],
        },
        {
            numbers: [1, -1, 1, -1],
            window: 2,
            align: "right",
            result: [1, 0, 0, 0],
        },
        {
            numbers: [1, undefined, null, -1, 1],
            window: 2,
            align: "right",
            result: [
                1,
                ErrorValueTypes.UndefinedButShouldBeNumber,
                ErrorValueTypes.NullButShouldBeNumber,
                -1,
                0,
            ],
        },
        {
            numbers: [1, 3, 5, 1],
            window: 3,
            align: "right",
            result: [1, 2, 3, 3],
        },
        {
            numbers: [0, 2, 4, 0],
            window: 3,
            align: "center",
            result: [1, 2, 2, 2],
        },
    ]
    it("computes the rolling average", () => {
        testCases.forEach((testCase) => {
            expect(
                computeRollingAverage(
                    testCase.numbers,
                    testCase.window,
                    testCase.align
                )
            ).toEqual(testCase.result)
        })
    })
})

describe(extractDataSlugsFromTransformString, () => {
    it("extracts data slugs from transforms", () => {
        expect(
            extractDataSlugsFromTransformString("asPercentageOf slug 256972")
        ).toStrictEqual({
            transformName: "asPercentageOf",
            dataSlugs: ["slug", "256972"],
        })
        expect(
            extractDataSlugsFromTransformString(
                "timeSinceEntityExceededThreshold time entity slug 50"
            )
        ).toStrictEqual({
            transformName: "timeSinceEntityExceededThreshold",
            dataSlugs: ["slug"],
        })
        expect(
            extractDataSlugsFromTransformString("divideBy 256972 slug")
        ).toStrictEqual({
            transformName: "divideBy",
            dataSlugs: ["256972", "slug"],
        })
        expect(
            extractDataSlugsFromTransformString(
                "rollingAverage time entity slug 7"
            )
        ).toStrictEqual({
            transformName: "rollingAverage",
            dataSlugs: ["slug"],
        })
        expect(
            extractDataSlugsFromTransformString(
                "percentChange my-time my-entity 256972 2"
            )
        ).toStrictEqual({
            transformName: "percentChange",
            dataSlugs: ["256972"],
        })
        expect(
            extractDataSlugsFromTransformString("multiplyBy slug 2")
        ).toStrictEqual({
            transformName: "multiplyBy",
            dataSlugs: ["slug"],
        })
        expect(
            extractDataSlugsFromTransformString("subtract 256972 slug")
        ).toStrictEqual({
            transformName: "subtract",
            dataSlugs: ["256972", "slug"],
        })
    })
    it("extracts a unique list of data slugs", () => {
        expect(
            extractDataSlugsFromTransformString("256972 subtract 256972")
        ).toStrictEqual({
            transformName: "subtract",
            dataSlugs: ["256972"],
        })
    })
    it("allows the transform name to be in different positions", () => {
        expect(
            extractDataSlugsFromTransformString("multiplyBy my-slug 2")
        ).toStrictEqual({
            transformName: "multiplyBy",
            dataSlugs: ["my-slug"],
        })
        expect(
            extractDataSlugsFromTransformString("256972 multiplyBy 2")
        ).toStrictEqual({
            transformName: "multiplyBy",
            dataSlugs: ["256972"],
        })
    })
    it("returns undefined for inputs that are not transforms", () => {
        expect(
            extractDataSlugsFromTransformString(
                "some-string pretending-to-be a transform"
            )
        ).toBeUndefined()
    })
})
