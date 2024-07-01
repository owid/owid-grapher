#! /usr/bin/env jest

import { setValueRecursive, setValueRecursiveInplace } from "./patchHelper.js"

interface PatchHelperTestCase {
    pointer: string[]
    newValue: any
    jsonValueBefore: any
    jsonValueAfter: any
}

const testCases: PatchHelperTestCase[] = [
    {
        pointer: ["a", "b"],
        newValue: 2,
        jsonValueBefore: {},
        jsonValueAfter: { a: { b: 2 } },
    },
    {
        pointer: ["a", "b", "c"],
        newValue: 2,
        jsonValueBefore: {},
        jsonValueAfter: { a: { b: { c: 2 } } },
    },
    {
        pointer: ["a", "0", "b"],
        newValue: 2,
        jsonValueBefore: {},
        jsonValueAfter: { a: [{ b: 2 }] },
    },
    {
        pointer: ["a", "b", "0"],
        newValue: 2,
        jsonValueBefore: {},
        jsonValueAfter: { a: { b: [2] } },
    },
    {
        pointer: ["a", "b", "1"],
        newValue: 2,
        jsonValueBefore: {},
        jsonValueAfter: { a: { b: [2] } },
    },
    {
        pointer: ["a", "b"],
        newValue: [1, 2],
        jsonValueBefore: {},
        jsonValueAfter: { a: { b: [1, 2] } },
    },
    {
        pointer: ["a", "b"],
        newValue: 2,
        jsonValueBefore: { a: { z: 4 }, y: "y" },
        jsonValueAfter: { a: { b: 2, z: 4 }, y: "y" },
    },
    {
        pointer: ["a", "b", "c"],
        newValue: 2,
        jsonValueBefore: { a: { z: 4 }, y: "y" },
        jsonValueAfter: { a: { b: { c: 2 }, z: 4 }, y: "y" },
    },
    {
        pointer: ["a", "0", "b"],
        newValue: 2,
        jsonValueBefore: { a: [{ z: 4 }, { b: 1 }] },
        jsonValueAfter: { a: [{ b: 2, z: 4 }, { b: 1 }] },
    },
    {
        pointer: ["a", "b", "0"],
        newValue: 2,
        jsonValueBefore: { a: { z: 4 }, y: "y" },
        jsonValueAfter: { a: { b: [2], z: 4 }, y: "y" },
    },
    // --- same as before but with previous values set
    {
        pointer: ["a", "b"],
        newValue: [1, 2],
        jsonValueBefore: { a: { b: 4 }, y: "y" },
        jsonValueAfter: { a: { b: [1, 2] }, y: "y" },
    },
    {
        pointer: ["a", "b"],
        newValue: 2,
        jsonValueBefore: { a: { b: { c: 4 } } },
        jsonValueAfter: { a: { b: 2 } },
    },
    {
        pointer: ["a", "b", "c"],
        newValue: 2,
        jsonValueBefore: { a: { b: { c: [3, 4] } } },
        jsonValueAfter: { a: { b: { c: 2 } } },
    },
    {
        pointer: ["a", "0", "b"],
        newValue: 2,
        jsonValueBefore: { a: [] },
        jsonValueAfter: { a: [{ b: 2 }] },
    },
    {
        pointer: ["a", "0", "b"],
        newValue: 2,
        jsonValueBefore: { a: [{ b: 1 }, { b: 3 }] },
        jsonValueAfter: { a: [{ b: 2 }, { b: 3 }] },
    },
    {
        pointer: ["a", "b", "0"],
        newValue: 2,
        jsonValueBefore: { a: { b: [{ c: 1 }] } },
        jsonValueAfter: { a: { b: [2] } },
    },
    {
        pointer: ["a", "b", "1"],
        newValue: 2,
        jsonValueBefore: { a: { b: [{ c: 1 }] } },
        jsonValueAfter: { a: { b: [{ c: 1 }, 2] } },
    },
    {
        pointer: ["a", "b"],
        newValue: [1, 2],
        jsonValueBefore: { a: { b: [0] } },
        jsonValueAfter: { a: { b: [1, 2] } },
    },
]

it("can set values correctly", () => {
    for (const testCase of testCases) {
        const result = setValueRecursive(
            testCase.jsonValueBefore,
            testCase.pointer,
            testCase.newValue
        )
        expect(result).toEqual(testCase.jsonValueAfter)
    }
})

it("can set values correctly inplace", () => {
    for (const testCase of testCases) {
        const testValue = testCase.jsonValueBefore
        try {
            setValueRecursiveInplace(
                testValue,
                testCase.pointer,
                testCase.newValue
            )
        } catch (e) {
            console.error("Error when processing", testCase)
            throw e
        }
        expect(testValue).toEqual(testCase.jsonValueAfter)
    }
})
