#! /usr/bin/env yarn jest

import { GridProgram } from "./GridProgram"

describe(GridProgram, () => {
    it("can create a program", () => {
        const program = new GridProgram("test", "")
        expect(program.lines.length).toEqual(1)
    })

    it("can set values", () => {
        const program = new GridProgram("test", "title\thello world")
        expect(program.getLineValue("title")).toEqual("hello world")

        expect(
            program.setLineValue("title", "good morning").getLineValue("title")
        ).toEqual("good morning")
    })

    it("can find rows", () => {
        expect(
            new GridProgram(
                "test",
                `table\ntableName\ntable\tall\n`
            ).getRowNumbersStartingWith("table")
        ).toEqual([0, 2])
    })

    describe("blocks", () => {
        const program = new GridProgram(
            "test",
            `table
\tslug
\tcountry`
        )

        it("can get blocks", () => {
            expect(program.getBlock(0)).toEqual(`slug\ncountry`)
        })

        it("can search", () => {
            expect(program.getRowMatchingWords(undefined, "country")).toEqual(2)
            expect(program.getRowMatchingWords(undefined, "nada")).toEqual(-1)
        })

        it("can update blocks", () => {
            const newBlock = `slug\tname
country\tCountry`
            const newProgram = program.updateBlock(0, newBlock)
            expect(newProgram.getBlock(0)).toEqual(newBlock)
        })

        it("can delete blocks", () => {
            expect(program.deleteBlock(0).toString()).toEqual(`table`)

            const program2 = new GridProgram(
                "test",
                `table
\tslug
\tcountry
columns
\tone`
            )

            expect(program2.deleteBlock(3).toString()).toEqual(`table
\tslug
\tcountry
columns`)
        })
    })

    describe("scan", () => {
        const program = new GridProgram(
            "test",
            `table
\tslug
columns
\tslug`
        )

        it("can loop", () => {
            const expected = ["table", "", "slug", "columns", "", "slug"]
            expect(Array.from(program.valuesFrom())).toEqual(expected)
            expect(
                Array.from(program.valuesFrom({ row: 100, column: 10 }))
            ).toEqual(expected)

            expect(
                Array.from(
                    new GridProgram("est", "").valuesFrom({ row: 1, column: 1 })
                )
            ).toEqual([""])

            expect(
                Array.from(
                    new GridProgram("est", "a\nb").valuesFrom({
                        row: 1,
                        column: 0,
                    })
                )
            ).toEqual(["a", "", "b"])

            expect(
                Array.from(program.valuesFrom({ row: 1, column: 2 }))
            ).toEqual(["columns", "", "slug", "table", "", "slug"])
        })

        it("can grep", () => {
            expect(program.grepFirst("columns")).toEqual({ row: 2, column: 0 })
            expect(program.grepFirst("columns222")).toEqual(undefined)
        })

        it("can find next", () => {
            expect(program.findNext({ row: 1, column: 1 })).toEqual({
                row: 3,
                column: 1,
            })
            expect(program.findNext({ row: 0, column: 1 })).toEqual(undefined)
        })
    })
})
