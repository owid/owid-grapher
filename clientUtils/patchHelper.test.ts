#! /usr/bin/env jest

import { setValueRecursive } from "./patchHelper"

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
    {
        pointer: ["a", "b"],
        newValue: [1, 2],
        jsonValueBefore: { a: { z: 4 }, y: "y" },
        jsonValueAfter: { a: { b: [1, 2], z: 4 }, y: "y" },
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
