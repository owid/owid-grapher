#! /usr/bin/env jest

import {
    DEFAULT_COLUMN_DELIMITER,
    objectFromPatch,
    objectToPatch,
} from "./Patch"

it("can create a patch", () => {
    const tests = [
        { object: { foo: "bar" }, patch: `foo${DEFAULT_COLUMN_DELIMITER}bar` },
        { patch: "", object: {} },
    ]
    tests.forEach((test) => {
        expect(objectToPatch(test.object)).toEqual(test.patch)
        expect(objectFromPatch(test.patch)).toEqual(test.object)
    })
})
