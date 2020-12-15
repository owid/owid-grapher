#! /usr/bin/env jest

import { DefaultPatchGrammar, Patch } from "./Patch"

describe(Patch, () => {
    const encodeString = (str: string) =>
        str
            .replace(/\.\.\./g, DefaultPatchGrammar.rowDelimiter)
            .replace(/~/g, DefaultPatchGrammar.columnDelimiter)
    const tests: { string: string; object?: any; array: string[][] }[] = [
        {
            string: encodeString(`foo~bar`),
            object: { foo: "bar" },
            array: [["foo", "bar"]],
        },
        { string: "", object: {}, array: [[""]] },
        {
            string: encodeString(`Country+Name~United+States`),
            object: { "Country Name": "United States" },
            array: [["Country Name", "United States"]],
        },
        {
            string: encodeString(`countries~United+States~Germany...chart~Map`),
            object: {
                countries: ["United States", "Germany"],
                chart: "Map",
            },
            array: [
                ["countries", "United States", "Germany"],
                ["chart", "Map"],
            ],
        },
        {
            string: `group~HighIncome~Canada~Norway...group~MediumIncome~Spain~Greece`,
            array: [
                ["group", "HighIncome", "Canada", "Norway"],
                ["group", "MediumIncome", "Spain", "Greece"],
            ],
        },
        {
            string: `filters~...~time~lastMonth`,
            array: [
                [`filters`, ""],
                ["", `time`, `lastMonth`],
            ],
            object: {
                filters: "",
                "": [`time`, `lastMonth`],
            },
        },
        {
            string: `paragraph${DefaultPatchGrammar.columnDelimiter}${DefaultPatchGrammar.encodedRowDelimiter}${DefaultPatchGrammar.encodedColumnDelimiter}`,
            object: {
                paragraph: `${DefaultPatchGrammar.rowDelimiter}${DefaultPatchGrammar.columnDelimiter}`,
            },
            array: [
                [
                    "paragraph",
                    `${DefaultPatchGrammar.rowDelimiter}${DefaultPatchGrammar.columnDelimiter}`,
                ],
            ],
        },
    ]
    tests.forEach((test) => {
        if (test.object) {
            it("can encode objects to strings", () => {
                expect(new Patch(test.object).uriEncodedString).toEqual(
                    test.string
                )
            })
            it("can encode objects to arrays", () => {
                expect(new Patch(test.object).array).toEqual(test.array)
            })

            it("can encode strings to objects", () => {
                expect(new Patch(test.string).object).toEqual(test.object)
            })

            it("can encode arrays to objects", () => {
                expect(new Patch(test.array).object).toEqual(test.object)
            })
        }

        it("can encode strings to arrays", () => {
            expect(new Patch(test.string).array).toEqual(test.array)
        })

        it("can encode arrays to strings", () => {
            expect(new Patch(test.array).uriEncodedString).toEqual(test.string)
        })
    })

    it("can pass the devils test case", () => {
        const original = {
            title: "!*'();:@&=+$,/?#[]-_.~|\"\\",
        }
        expect(new Patch(new Patch(original).uriEncodedString).object).toEqual(
            original
        )
    })
})
