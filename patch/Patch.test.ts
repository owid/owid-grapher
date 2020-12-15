#! /usr/bin/env jest

import { DEFAULT_COLUMN_DELIMITER, Patch } from "./Patch"

describe(Patch, () => {
    const tests = [
        { string: `foo${DEFAULT_COLUMN_DELIMITER}bar`, object: { foo: "bar" } },
        { string: "", object: {} },
        {
            string: `Country+Name${DEFAULT_COLUMN_DELIMITER}United+States`,
            object: { "Country Name": "United States" },
        },
    ]
    tests.forEach((test) => {
        it("can encode objects", () => {
            expect(new Patch(test.object).uriEncodedString).toEqual(test.string)
        })

        it("can decode objects", () => {
            expect(new Patch(test.string).object).toEqual(test.object)
        })
    })
})
