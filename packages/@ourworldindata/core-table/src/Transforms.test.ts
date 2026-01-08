import { expect, it, describe } from "vitest"

import {
    insertMissingValuePlaceholders,
    computeRollingAverage,
    parseTransformString,
    TransformParamType,
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

describe(parseTransformString, () => {
    it("extracts data slugs from transforms", () => {
        expect(
            parseTransformString("asPercentageOf slug 256972")
        ).toStrictEqual({
            transformName: "asPercentageOf",
            params: [
                { type: TransformParamType.DataSlug, value: "slug" },
                { type: TransformParamType.DataSlug, value: "256972" },
            ],
        })
        expect(
            parseTransformString(
                "timeSinceEntityExceededThreshold time entity slug 50"
            )
        ).toStrictEqual({
            transformName: "timeSinceEntityExceededThreshold",
            params: [
                { type: TransformParamType.TimeSlug, value: "time" },
                { type: TransformParamType.EntitySlug, value: "entity" },
                { type: TransformParamType.DataSlug, value: "slug" },
                { type: TransformParamType.String, value: "50" },
            ],
        })
        expect(parseTransformString("divideBy 256972 slug")).toStrictEqual({
            transformName: "divideBy",
            params: [
                { type: TransformParamType.DataSlug, value: "256972" },
                { type: TransformParamType.DataSlug, value: "slug" },
            ],
        })
        expect(
            parseTransformString("rollingAverage time entity slug 7")
        ).toStrictEqual({
            transformName: "rollingAverage",
            params: [
                { type: TransformParamType.TimeSlug, value: "time" },
                { type: TransformParamType.EntitySlug, value: "entity" },
                { type: TransformParamType.DataSlug, value: "slug" },
                { type: TransformParamType.Number, value: "7" },
            ],
        })
        expect(
            parseTransformString("percentChange my-time my-entity 256972 2")
        ).toStrictEqual({
            transformName: "percentChange",
            params: [
                { type: TransformParamType.TimeSlug, value: "my-time" },
                { type: TransformParamType.EntitySlug, value: "my-entity" },
                { type: TransformParamType.DataSlug, value: "256972" },
                { type: TransformParamType.Number, value: "2" },
            ],
        })
        expect(parseTransformString("multiplyBy slug 2")).toStrictEqual({
            transformName: "multiplyBy",
            params: [
                { type: TransformParamType.DataSlug, value: "slug" },
                { type: TransformParamType.Number, value: "2" },
            ],
        })
        expect(parseTransformString("subtract 256972 slug")).toStrictEqual({
            transformName: "subtract",
            params: [
                { type: TransformParamType.DataSlug, value: "256972" },
                { type: TransformParamType.DataSlug, value: "slug" },
            ],
        })
    })
    it("extracts a unique list of data slugs", () => {
        expect(parseTransformString("256972 subtract 256972")).toStrictEqual({
            transformName: "subtract",
            params: [
                { type: TransformParamType.DataSlug, value: "256972" },
                { type: TransformParamType.DataSlug, value: "256972" },
            ],
        })
    })
    it("allows the transform name to be in different positions", () => {
        expect(parseTransformString("multiplyBy my-slug 2")).toStrictEqual({
            transformName: "multiplyBy",
            params: [
                { type: TransformParamType.DataSlug, value: "my-slug" },
                { type: TransformParamType.Number, value: "2" },
            ],
        })
        expect(parseTransformString("256972 multiplyBy 2")).toStrictEqual({
            transformName: "multiplyBy",
            params: [
                { type: TransformParamType.DataSlug, value: "256972" },
                { type: TransformParamType.Number, value: "2" },
            ],
        })
    })
    it("returns undefined for inputs that are not transforms", () => {
        expect(
            parseTransformString("some-string pretending-to-be a transform")
        ).toBeUndefined()
    })
})
