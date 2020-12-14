#! /usr/bin/env jest

import { DEFAULT_COLUMN_DELIMITER, Patch } from "./Patch"

describe(Patch, () => {
    const tests = [
        { object: { foo: "bar" }, string: `foo${DEFAULT_COLUMN_DELIMITER}bar` },
        { string: "", object: {} },
    ]
    tests.forEach((test) => {
        it("can encode objects", () => {
            expect(new Patch(test.object).string).toEqual(test.string)
        })

        it("can decode objects", () => {
            expect(new Patch(test.string).object).toEqual(test.object)
        })
    })
})
